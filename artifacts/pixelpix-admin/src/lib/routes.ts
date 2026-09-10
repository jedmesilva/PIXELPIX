export const adminRoutes = {
  overview: '/',
  prizePool: '/prize-pool',
  redemptions: '/redemptions',
  manual: '/manual',
} as const;

export type AdminRoute = (typeof adminRoutes)[keyof typeof adminRoutes];