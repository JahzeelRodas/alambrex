import type { DashboardData } from '../../types/api';

export interface TabProps {
  data: DashboardData;
  refresh: () => void;
}
