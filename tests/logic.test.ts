import { describe, expect, it } from 'vitest';
import {
  assertRaceTransition,
  buildReservationMessage,
  buildWhatsAppUrl,
  computeExpiresAt,
  isValidLane,
} from '../src/server/modules/reservations/logic';

describe('isValidLane', () => {
  it('acepta carriles 1..6', () => {
    expect(isValidLane(1)).toBe(true);
    expect(isValidLane(6)).toBe(true);
  });
  it('rechaza carriles fuera de rango', () => {
    expect(isValidLane(0)).toBe(false);
    expect(isValidLane(7)).toBe(false);
    expect(isValidLane(2.5)).toBe(false);
    expect(isValidLane(NaN)).toBe(false);
  });
});

describe('computeExpiresAt', () => {
  it('suma los minutos indicados', () => {
    const base = new Date('2026-01-01T10:00:00Z');
    expect(computeExpiresAt(base, 30).getTime()).toBe(base.getTime() + 30 * 60_000);
  });
});

describe('assertRaceTransition', () => {
  it('permite transiciones válidas', () => {
    expect(() => assertRaceTransition('open', 'running')).not.toThrow();
    expect(() => assertRaceTransition('running', 'finished')).not.toThrow();
    expect(() => assertRaceTransition('finished', 'open')).not.toThrow();
    expect(() => assertRaceTransition('open', 'open')).not.toThrow();
  });
  it('rechaza transiciones inválidas', () => {
    expect(() => assertRaceTransition('finished', 'running')).toThrow();
    expect(() => assertRaceTransition('pending', 'running')).toThrow();
    expect(() => assertRaceTransition('cancelled', 'finished')).toThrow();
  });
});

describe('buildWhatsAppUrl', () => {
  it('normaliza el número y codifica el mensaje', () => {
    const url = buildWhatsAppUrl('+52 1 55 1234 5678', 'Hola mundo');
    expect(url.startsWith('https://wa.me/5215512345678?text=')).toBe(true);
    expect(url).toContain(encodeURIComponent('Hola mundo'));
  });
  it('elimina caracteres no numéricos', () => {
    expect(buildWhatsAppUrl('(55)-1234', 'x').startsWith('https://wa.me/551234?text=')).toBe(true);
  });
});

describe('buildReservationMessage', () => {
  it('incluye los datos de la inscripción', () => {
    const message = buildReservationMessage({
      eventName: 'Gran Prix',
      raceNumber: 3,
      lane: 5,
      carName: 'Twin Mill',
      participantName: 'Ana',
      token: 'abcdef12',
      price: 100,
    });
    expect(message).toContain('Gran Prix');
    expect(message).toContain('#3');
    expect(message).toContain('5');
    expect(message).toContain('Twin Mill');
    expect(message).toContain('Ana');
    expect(message).toContain('abcdef12');
    expect(message).toContain('$100');
  });
  it('omite la cuota si es 0', () => {
    const message = buildReservationMessage({
      eventName: 'Jornada',
      raceNumber: 1,
      lane: 1,
      carName: 'X',
      participantName: 'Luis',
      token: 'tok',
      price: 0,
    });
    expect(message).not.toContain('Cuota');
  });
});
