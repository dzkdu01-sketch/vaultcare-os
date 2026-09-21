import test from 'node:test'
import assert from 'node:assert/strict'

import { createCanvas, loadImage } from '@napi-rs/canvas'

import {
  GALLERY_IMAGE_SIZE,
  isGalleryImageFile,
  optimizeGalleryImage,
  parseImageAssetFileName,
  processSupplierImage,
  SupplierMediaError,
  toWebp,
} from './supplier-media.js'

function makePng(width: number, height: number, color = '#cc3344'): Buffer {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = color
  ctx.fillRect(0, 0, width, height)
  return canvas.toBuffer('image/png')
}

test('optimizeGalleryImage 把非正方形图做成 800×800 webp', async () => {
  const out = await optimizeGalleryImage(makePng(1200, 600))
  const image = await loadImage(out)
  assert.equal(image.width, GALLERY_IMAGE_SIZE)
  assert.equal(image.height, GALLERY_IMAGE_SIZE)
})

test('optimizeGalleryImage 小图也铺到 800×800', async () => {
  const out = await optimizeGalleryImage(makePng(10, 10, '#112233'))
  const image = await loadImage(out)
  assert.equal(image.width, GALLERY_IMAGE_SIZE)
  assert.equal(image.height, GALLERY_IMAGE_SIZE)
})

test('processSupplierImage 描述内嵌图保持原尺寸', async () => {
  const out = await processSupplierImage(makePng(120, 80), 'embedded')
  const image = await loadImage(out)
  assert.equal(image.width, 120)
  assert.equal(image.height, 80)
})

test('optimizeGalleryImage 坏 buffer 回退 toWebp，两者都失败则抛错而不是空图', async () => {
  const garbage = Buffer.from('not-an-image')
  await assert.rejects(() => optimizeGalleryImage(garbage), SupplierMediaError)
  await assert.rejects(() => toWebp(garbage), SupplierMediaError)
})

test('parseImageAssetFileName / isGalleryImageFile 按序号认相册', () => {
  assert.deepEqual(parseImageAssetFileName('VC459-1.webp'), { sku: 'VC459', index: 1 })
  assert.deepEqual(parseImageAssetFileName('G6-1-2.webp'), { sku: 'G6-1', index: 2 })
  assert.equal(parseImageAssetFileName('VC459-s1.mp4'), null)
  assert.equal(isGalleryImageFile('VC459-2.webp', 2), true)
  assert.equal(isGalleryImageFile('VC459-3.webp', 2), false)
  assert.equal(isGalleryImageFile('VC459-s1.mp4', 4), false)
})
