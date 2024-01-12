// 爱逛的吧
export const LOVE_BAR = '/html/body//div[@id="left-cont-wraper"]';

// 一键签到
export const ONE_KEY_SIGN = '/html/body//div[@id="onekey_sign"]//a';

// 一键签到-开始签到
export const ONE_KEY_SIGN_START =
  '/html/body/div//div[@id="dialogJbody"]//div[count(.//a)=1 and count(.//p) = 1]//a';

// 最近逛过的吧
export const RECENTLY_BAR = LOVE_BAR + '//div[@id="likeforumwraper"]//a';

// 查看更多
export const VIEW_MORE = LOVE_BAR + '//div[@id="moreforum"]';
