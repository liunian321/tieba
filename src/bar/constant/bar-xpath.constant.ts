/**
 * 我的贴吧-入口
 */
export const MY_BAR_ENTRANCE = '/html/body//div[@id="my_tieba_mod"]//div[@class="media_right"]//a[contains(@href,"/home/main")]';

/**
 * 个人信息栏
 */
export const PERSONAL_INFO = '/html/body//div[@class="userinfo_middle"]';

/**
 * 个人信息栏-用户名 ex: 用户名:xxx
 */
export const PERSONAL_INFO_USERNAME = PERSONAL_INFO + '//*[@class="user_name"]/text()';

/**
 * 个人信息栏-吧龄
 */
export const PERSONAL_INFO_BAR_AGE = PERSONAL_INFO + '//*[@class="userinfo_split"]/following-sibling::*[contains(text(),"吧龄")]/text()';

/**
 * 个人信息栏-发贴数量
 */
export const PERSONAL_INFO_POST_NUM = PERSONAL_INFO + '//*[@class="userinfo_split"]/following-sibling::*[contains(text(),"发贴")]/text()';

/**
 * 个人信息栏-IP属地
 */
export const PERSONAL_INFO_IP_LOCATION = PERSONAL_INFO + '//*[@class="userinfo_split"]/following-sibling::*[contains(text(),"IP属地")]/text()';

/**
 * 个人信息栏-男性
 */
export const PERSONAL_INFO_MALE = PERSONAL_INFO + '//*[contains(@class,"userinfo_sex_male")]';

/**
 * 个人信息栏-女性
 */
export const PERSONAL_INFO_FEMALE = PERSONAL_INFO + '//*[contains(@class,"userinfo_sex_female")]';
