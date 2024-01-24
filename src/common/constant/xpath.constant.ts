// 爱逛的吧
export const LOVE_BAR = '/html/body//div[@id="left-cont-wraper"]';

// 一键签到
export const ONE_KEY_SIGN = '/html/body//div[@id="onekey_sign"]//a';

// 一键签到-开始签到
export const ONE_KEY_SIGN_START = '/html/body/div//div[@id="dialogJbody"]//div[count(.//a)=1 and count(.//p) = 1]//a';

// 一键签到-已经签到
export const ONE_KEY_SIGN_SIGNED = '/html/body/div//div[@id="dialogJbody"]//span[contains(@class,"sign_fail") or contains(@class,"sign_suc")]';

// 已经签到吧数
export const ONE_KEY_SIGN_SIGNED_COUNT = '/html/body/div//div[@id="dialogJbody"]//span[contains(@class,"signnum_succ")]';

// 还未签到吧数
export const ONE_KEY_SIGN_UN_SIGN_COUNT = '/html/body/div//div[@id="dialogJbody"]//span[contains(@class,"signnum_fail")]';

// 关闭一键签到弹窗
export const ONE_KEY_SIGN_CLOSE = '/html/body/div//div[@class="dialogJtitle"]/a';

// 最近逛过的吧(未签到)
export const RECENTLY_BAR_UN_SIGN = LOVE_BAR + '//div[@id="likeforumwraper"]//a[contains(@class,"unsign")]';

// 最近逛过的吧(已签到)
export const RECENTLY_BAR_SIGN = LOVE_BAR + '//div[@id="likeforumwraper"]//a[contains(@class,"sign")]';

// 查看更多
export const VIEW_MORE = LOVE_BAR + '//div[@id="moreforum"]';

// 未签到的吧
export const UN_SIGN_BAR = '/html/body/div//div[@id="forumscontainer"]//a[@class="unsign"]';

// 签到已完成
export const SIGN_COMPLETE = '/html/body/div//a[@title="签到完成"]';

// 还未签到
export const UN_SIGN = '/html/body/div//a[@title="签到"]';
