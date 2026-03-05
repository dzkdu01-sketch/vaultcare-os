export interface ProductTagOption {
  key: string
  label: string
}

export const AUDIENCE_TAG_OPTIONS: ProductTagOption[] = [
  { key: 'for_her', label: '她用' },
  { key: 'for_him', label: '他用' },
  { key: 'for_couples', label: '情侣' },
]

export const AI_NEW_PRODUCT_STEPS = ['上传图片', '确认信息', '填写价格']
export const MANUAL_NEW_PRODUCT_STEPS = ['确认信息', '填写价格', '保存草稿']
export const UNIFIED_ENTRY_STEPS = ['基本信息', '价格与设置']

export const AI_STEP_HINTS: Record<number, string> = {
  1: '当前步骤：上传图片。下一步将确认 AI 建议信息。',
  2: '当前步骤：确认信息。下一步将填写价格与市场范围。',
  3: '当前步骤：填写价格并保存草稿。保存后可进入详情页继续完善。',
}

export const MANUAL_STEP_HINTS: Record<number, string> = {
  1: '当前步骤：确认信息。下一步将填写价格与市场范围。',
  2: '当前步骤：填写价格。下一步将确认信息并保存草稿。',
  3: '当前步骤：确认并保存草稿。保存后可进入详情页继续完善。',
}

export const UNIFIED_STEP_HINTS: Record<number, string> = {
  1: '当前步骤：基本信息。填写标题、品类、标签、图片、描述等信息，可使用 AI 辅助识别和优化。',
  2: '当前步骤：价格与设置。填写价格信息并保存为草稿。',
}
