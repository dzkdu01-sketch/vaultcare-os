/**
 * 「情趣图片」下每个一级子文件夹内的文件（仅该层，不含子目录）按文件名排序后重命名为：
 *   {文件夹名}-1.{原扩展名}、{文件夹名}-2.{原扩展名} …
 *
 *   node scripts/rename-pic-folder-files-seq.mjs
 *   node scripts/rename-pic-folder-files-seq.mjs --apply
 *
 * PIC_ROOT 可覆盖根目录。
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const defaultRoot = path.join('C:', 'Users', '杜兆凯', 'Desktop', '情趣图片')
const rootDir = process.env.PIC_ROOT || defaultRoot
const apply = process.argv.includes('--apply')

const SKIP_NAMES = new Set(['desktop.ini', 'thumbs.db', '.ds_store'])

function isSkippedFile(base) {
  const lower = base.toLowerCase()
  if (SKIP_NAMES.has(lower)) return true
  if (base.startsWith('.')) return true
  return false
}

function listFilesOnly(dir) {
  return fs
    .readdirSync(dir)
    .filter(n => {
      if (isSkippedFile(n)) return false
      try {
        return fs.statSync(path.join(dir, n)).isFile()
      } catch {
        return false
      }
    })
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
}

function main() {
  if (!fs.existsSync(rootDir)) {
    console.error('目录不存在:', rootDir)
    process.exit(1)
  }

  const entries = fs.readdirSync(rootDir, { withFileTypes: true })
  const subdirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort((a, b) => a.localeCompare(b, 'en'))

  console.log(`根目录: ${rootDir}`)
  console.log(`模式: ${apply ? '执行重命名' : '仅预览（加 --apply 执行）'}`)
  console.log(`规则: 各子文件夹内仅处理直接子文件，排序后 → {文件夹名}-序号.扩展名\n`)

  let grandTotal = 0

  for (const folderName of subdirs) {
    const dir = path.join(rootDir, folderName)
    const files = listFilesOnly(dir)
    if (files.length === 0) continue

    const targets = files.map((oldName, i) => {
      const ext = path.extname(oldName)
      return `${folderName}-${i + 1}${ext}`
    })

    const needsWork = files.some((oldName, i) => oldName !== targets[i])
    if (!needsWork) {
      console.log(`[${folderName}] ${files.length} 个文件已是目标命名，跳过。`)
      grandTotal += files.length
      continue
    }

    console.log(`--- ${folderName} (${files.length} 个文件) ---`)
    files.forEach((oldName, i) => {
      const t = targets[i]
      console.log(`  ${oldName === t ? '(已是) ' : ''}${oldName}  →  ${t}`)
    })
    console.log('')
    grandTotal += files.length

    if (!apply) continue

    const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const tmps = files.map((oldName, i) => path.join(dir, `.__seq_${stamp}_${i}_${oldName}`))

    for (let i = 0; i < files.length; i++) {
      fs.renameSync(path.join(dir, files[i]), tmps[i])
    }
    for (let i = 0; i < files.length; i++) {
      const finalPath = path.join(dir, targets[i])
      if (fs.existsSync(finalPath)) {
        console.error('异常：临时阶段后目标已存在:', finalPath)
        process.exit(1)
      }
      fs.renameSync(tmps[i], finalPath)
    }
  }

  console.log(`共处理 ${subdirs.length} 个子文件夹中的文件（见上）。`)
  if (!apply) console.log('\n加 --apply 执行重命名。')
  else console.log('\n完成。')
}

main()
