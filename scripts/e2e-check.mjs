
const BASE = 'http://localhost:4000/api';

let cookie = '';
let csrf = '';
let failures = 0;

function assert(cond, name, detail = '') {
  if (cond) {
    console.log(`✔ ${name}`);
  } else {
    failures++;
    console.log(`✘ FALLO: ${name} ${detail}`);
  }
}

async function call(method, path, body) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers['Cookie'] = cookie;
  if (csrf && method !== 'GET') headers['X-CSRF-Token'] = csrf;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  let json = null;
  try {
    json = await res.json();
  } catch {

  }
  return { status: res.status, json };
}

async function main() {

  const anon = await call('GET', '/admin/dashboard');
  assert(anon.status === 401, 'Panel rechaza acceso sin sesión (401)');


  const health = await call('GET', '/health');
  assert(health.status === 200 && health.json.db === true, 'Health OK con MySQL activo', JSON.stringify(health.json));


  const login = await call('POST', '/admin/auth/login', { username: 'admin', password: 'Alanbrex2026!' });
  csrf = login.json?.csrfToken ?? '';
  assert(login.status === 200 && csrf.length === 64, 'Login administrativo exitoso');


  const savedCsrf = csrf;
  csrf = '';
  const noCsrf = await call('POST', '/admin/events', { name: 'X Y' });
  csrf = savedCsrf;
  assert(noCsrf.status === 403, 'Mutación sin CSRF rechazada (403)');


  const ev = await call('POST', '/admin/events', { name: 'Gran Prix Alanbrex #1', description: 'Jornada de prueba' });
  assert(ev.status === 201 && ev.json?.event?.id, 'Jornada creada');
  const eventId = ev.json.event.id;
  const setCurrent = await call('POST', `/admin/events/${eventId}/current`);
  assert(setCurrent.status === 200, 'Jornada marcada como actual');


  const cars = await call('GET', '/public/cars');
  assert(cars.json?.cars?.length === 6, 'Seis coches activos disponibles', String(cars.json?.cars?.length));


  const race1 = await call('POST', '/admin/races', { eventId });
  assert(race1.status === 201 && race1.json.race.raceNumber === 1 && race1.json.race.status === 'open', 'Carrera #1 creada y abierta');
  const race1Id = race1.json.race.id;
  const race2 = await call('POST', '/admin/races', { eventId });
  assert(race2.json.race.raceNumber === 2, 'Carrera #2 con numeración automática');
  const race2Id = race2.json.race.id;


  const carA = cars.json.cars[0];
  const carB = cars.json.cars[1];
  const res1 = await call('POST', '/public/reservations', {
    raceId: race1Id, lane: 1, carId: carA.id, participantName: 'Ana Prueba', contact: '5215512345678',
  });
  assert(res1.status === 201 && res1.json.reservation.token, 'Inscripción creada con token');
  const token1 = res1.json.reservation.token;
  const res1Id = res1.json.reservation.id;
  assert(
    typeof res1.json.whatsappUrl === 'string' && res1.json.whatsappUrl.includes('wa.me/5210000000000'),
    'URL de WhatsApp generada con el número del negocio',
    res1.json.whatsappUrl
  );


  const dup = await call('POST', '/public/reservations', {
    raceId: race1Id, lane: 1, carId: carB.id, participantName: 'Beto', contact: '5215511111111',
  });
  assert(dup.status === 409 && dup.json?.error?.code === 'LANE_TAKEN', 'Doble reserva del mismo carril rechazada (LANE_TAKEN)');
  const dupCar = await call('POST', '/public/reservations', {
    raceId: race1Id, lane: 2, carId: carA.id, participantName: 'Beto', contact: '5215511111111',
  });
  assert(dupCar.status === 409 && dupCar.json?.error?.code === 'CAR_TAKEN', 'Mismo coche en dos carriles rechazado (CAR_TAKEN)');


  const status1 = await call('GET', `/public/reservations/${token1}`);
  assert(status1.json?.reservation?.status === 'pending_payment', 'Reserva consultable por token (pendiente de pago)');


  const stream1 = await call('GET', `/public/races/${race1Id}/stream`);
  const lane1 = stream1.json?.race?.lanes?.find((l) => l.lane === 1);
  assert(lane1?.participantName === 'Ana Prueba' && lane1?.contact === null, 'Stream muestra participante y oculta el contacto');


  const confirm1 = await call('POST', `/admin/reservations/${res1Id}/confirm-payment`, { method: 'transfer' });
  assert(confirm1.status === 200 && confirm1.json.alreadyConfirmed === false, 'Pago confirmado (transaccional)');
  const confirmAgain = await call('POST', `/admin/reservations/${res1Id}/confirm-payment`, { method: 'transfer' });
  assert(confirmAgain.json?.alreadyConfirmed === true, 'Confirmar dos veces es idempotente (no duplica pago)');


  const lanes = [2, 3, 4, 5, 6];
  let ok = true;
  for (let i = 0; i < lanes.length; i++) {
    const r = await call('POST', '/public/reservations', {
      raceId: race1Id, lane: lanes[i], carId: cars.json.cars[i + 1].id,
      participantName: `Piloto ${i + 2}`, contact: `521551234567${i}`,
    });
    if (r.status !== 201) { ok = false; console.log('   detalle:', JSON.stringify(r.json)); }
    const c = await call('POST', `/admin/reservations/${r.json.reservation.id}/confirm-payment`, { method: 'cash' });
    if (c.status !== 200) { ok = false; console.log('   detalle confirm:', JSON.stringify(c.json)); }
  }
  assert(ok, 'Carriles 2-6 inscritos y confirmados');
  const full = await call('POST', '/public/reservations', {
    raceId: race1Id, lane: 1, carId: cars.json.cars[5].id, participantName: 'Séptimo', contact: '5215510000000',
  });
  assert(full.status === 409 && full.json?.error?.code === 'RACE_FULL', 'Séptima plaza rechazada (RACE_FULL)');


  const winner = await call('POST', `/admin/races/${race1Id}/winner`, { lane: 1 });
  assert(winner.json?.race?.status === 'finished' && winner.json?.race?.winnerLane === 1, 'Ganador registrado; carrera finalizada');
  const results = await call('GET', '/public/results');
  assert(results.json?.results?.some((r) => r.participantName === 'Ana Prueba'), 'Resultado visible en /public/results');


  const badStatus = await call('PATCH', `/admin/races/${race1Id}/status`, { status: 'running' });
  assert(badStatus.status === 409 && badStatus.json?.error?.code === 'INVALID_TRANSITION', 'Transición finished→running rechazada');


  const exp = await call('POST', '/public/reservations', {
    raceId: race2Id, lane: 1, carId: carA.id, participantName: 'Expirable', contact: '5215519999999',
  });
  const expId = exp.json.reservation.id;
  const expToken = exp.json.reservation.token;
  const mysql = (await import('mysql2/promise')).default;
  const dbc = await mysql.createConnection({ host: '127.0.0.1', port: 3306, user: 'root', password: '+JahzeelRodas', database: 'carreras_hw' });
  await dbc.query('UPDATE reservations SET expires_at = DATE_SUB(NOW(), INTERVAL 5 MINUTE) WHERE id = ?', [expId]);
  await dbc.end();
  const confirmExpired = await call('POST', `/admin/reservations/${expId}/confirm-payment`, { method: 'transfer' });
  assert(confirmExpired.status === 409 && confirmExpired.json?.error?.code === 'EXPIRED', 'Solicitud vencida no confirmable sin revalidar (EXPIRED)');
  const reactivate = await call('POST', `/admin/reservations/${expId}/reactivate`);
  assert(reactivate.status === 200, 'Reactivación/revalidación exitosa');
  const confirmReactivated = await call('POST', `/admin/reservations/${expId}/confirm-payment`, { method: 'transfer' });
  assert(confirmReactivated.status === 200, 'Pago confirmable tras revalidar');


  const cancel = await call('POST', `/admin/reservations/${expId}/cancel`);
  assert(cancel.status === 200, 'Cancelación administrativa');
  const freedLane = await call('POST', '/public/reservations', {
    raceId: race2Id, lane: 1, carId: carB.id, participantName: 'Nuevo Carril', contact: '5215518888888',
  });
  assert(freedLane.status === 201, 'Carril reutilizable tras cancelar');


  const dash = await call('GET', '/admin/dashboard');
  assert(dash.json?.event?.name === 'Gran Prix Alanbrex #1', 'Dashboard con jornada actual');
  assert(dash.json?.pending?.some((p) => p.participantName === 'Nuevo Carril'), 'El pago pendiente aparece en el dashboard');
  assert(dash.json?.audit?.some((a) => a.action === 'payment.confirm'), 'Auditoría registra payment.confirm');

  const setPut = await call('PUT', '/admin/settings', { key: 'stream_poll_ms', value: '2500' });
  assert(setPut.json?.streamPollMs === 2500, 'Ajuste de polling actualizado en caliente');
  const stream2 = await call('GET', '/public/stream');
  assert(stream2.json?.pollMs === 2500, 'Stream refleja el nuevo pollMs');
  const streamHome = await call('GET', '/public/stream');
  assert(streamHome.json.version === stream2.json.version, 'Versión estable sin cambios (polling barato)');


  const activeSet = await call('POST', `/admin/races/${race2Id}/active`);
  assert(activeSet.status === 200, 'Selección de carrera activa para streaming');

  console.log(failures === 0 ? '\n🎉 TODAS LAS PRUEBAS E2E PASARON' : `\n💥 ${failures} fallo(s)`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error('ERROR del script:', e);
  process.exit(1);
});
