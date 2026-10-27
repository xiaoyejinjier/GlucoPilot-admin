import type { FoodCategory, FoodItem } from '@/types'

export interface FoodImageOption {
  label: string
  value: string
}

const FOOD_IMAGE_ROOT = '/images/foods'

/** 管理端随源码发布的内置食物图片。 */
export const FOOD_IMAGE_OPTIONS: FoodImageOption[] = [
  ['米饭', 'rice'],
  ['燕麦', 'oat'],
  ['面条', 'noodle'],
  ['馒头', 'steamed-bun'],
  ['鸡胸肉', 'chicken'],
  ['鸡蛋', 'egg'],
  ['瘦猪肉', 'pork'],
  ['西兰花', 'broccoli'],
  ['黄瓜', 'cucumber'],
  ['西红柿', 'tomato'],
  ['苹果', 'apple'],
  ['香蕉', 'banana'],
  ['牛奶', 'milk'],
  ['酸奶', 'yogurt'],
  ['豆腐', 'tofu'],
  ['豆浆', 'soy-milk'],
  ['杏仁', 'almond'],
  ['核桃', 'walnut'],
  ['矿泉水', 'water'],
  ['无糖豆浆', 'sugar-free-soy-milk'],
  ['苏打饼干', 'cracker']
].map(([label, file]) => ({ label, value: `${FOOD_IMAGE_ROOT}/${file}.svg` }))

const imageByFoodName = new Map(FOOD_IMAGE_OPTIONS.map((item) => [item.label, item.value]))

const imageByCategory: Record<string, string> = {
  主食类: `${FOOD_IMAGE_ROOT}/rice.svg`,
  肉蛋类: `${FOOD_IMAGE_ROOT}/chicken.svg`,
  蔬菜类: `${FOOD_IMAGE_ROOT}/broccoli.svg`,
  水果类: `${FOOD_IMAGE_ROOT}/apple.svg`,
  奶类: `${FOOD_IMAGE_ROOT}/milk.svg`,
  豆制品: `${FOOD_IMAGE_ROOT}/tofu.svg`,
  坚果类: `${FOOD_IMAGE_ROOT}/almond.svg`,
  饮料类: `${FOOD_IMAGE_ROOT}/water.svg`,
  零食及其他: `${FOOD_IMAGE_ROOT}/cracker.svg`
}

const legacyImageMap: Record<string, string> = {
  '/img/food-rice.svg': `${FOOD_IMAGE_ROOT}/rice.svg`,
  '/img/food-oat.svg': `${FOOD_IMAGE_ROOT}/oat.svg`,
  '/img/food-noodle.svg': `${FOOD_IMAGE_ROOT}/noodle.svg`,
  '/img/food-bun.svg': `${FOOD_IMAGE_ROOT}/steamed-bun.svg`,
  '/img/food-chicken.svg': `${FOOD_IMAGE_ROOT}/chicken.svg`,
  '/img/food-egg.svg': `${FOOD_IMAGE_ROOT}/egg.svg`,
  '/img/food-broccoli.svg': `${FOOD_IMAGE_ROOT}/broccoli.svg`,
  '/img/food-apple.svg': `${FOOD_IMAGE_ROOT}/apple.svg`,
  '/img/food-banana.svg': `${FOOD_IMAGE_ROOT}/banana.svg`,
  '/img/food-milk.svg': `${FOOD_IMAGE_ROOT}/milk.svg`
}

export const DEFAULT_FOOD_IMAGE = `${FOOD_IMAGE_ROOT}/rice.svg`

/** 管理员已选用的上传配图应覆盖识别来源，不把旧卡通兜底视为换图。 */
export function isUploadedFoodImage(image?: string): boolean {
  return /^\/api\/v1\/foods\/images\/[1-9]\d*$/.test((image || '').trim())
}

/** 根据食物名优先、分类其次，返回仓库中的内置图片。 */
export function getBundledFoodImage(name?: string, categoryName?: string): string {
  return imageByFoodName.get((name || '').trim()) || imageByCategory[categoryName || ''] || DEFAULT_FOOD_IMAGE
}

/** 兼容数据库空值以及旧 Mock 中已经失效的图片地址。 */
export function resolveFoodImage(food: Pick<FoodItem, 'name' | 'categoryName' | 'image'>): string {
  const image = (food.image || '').trim()
  if (legacyImageMap[image]) return legacyImageMap[image]
  return image || getBundledFoodImage(food.name, food.categoryName)
}

/** 旧分类没有图片时按大类使用默认图片，不受食品名称映射影响。 */
export function resolveCategoryImage(category: Pick<FoodCategory, 'name' | 'image'>): string {
  return resolveFoodImage({ name: '', categoryName: category.name, image: category.image || '' })
}
