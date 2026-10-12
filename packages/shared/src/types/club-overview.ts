export interface ClubOverview {
 date: string;
 timeZone: 'America/Santiago';
 generatedAt: string;
 members: {total:number;active:number;newToday:number;new7Days:number;new30Days:number;birthdaysThisMonth:number};
 surveys: {total:number;notShown:number;viewed:number;skipped:number;responded:number};
 coupons: {available:number;redeemed:number;expired:number};
 redemptions: {today:number;last7Days:number};
}
