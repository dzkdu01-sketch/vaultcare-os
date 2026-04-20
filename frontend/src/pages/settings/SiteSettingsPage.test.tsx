import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SiteSettingsPage } from './ManagementCenterPage'

const mockGetSessionUser = vi.fn()
const mockSiteList = vi.fn()
const mockDistributorList = vi.fn()
const mockOperatorList = vi.fn()
const mockSettingsGet = vi.fn()
const mockMySites = vi.fn()
const mockMyOrganization = vi.fn()

vi.mock('../../app/store/auth-store', () => ({
  getSessionUser: () => mockGetSessionUser(),
}))

vi.mock('../../services/app-services', () => ({
  siteApi: {
    list: () => mockSiteList(),
    test: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    create: vi.fn(),
  },
  settingsApi: {
    get: () => mockSettingsGet(),
    update: vi.fn(),
  },
  distributorApi: {
    list: () => mockDistributorList(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    mySites: () => mockMySites(),
    myOrganization: () => mockMyOrganization(),
    createMySite: vi.fn(),
    updateMySite: vi.fn(),
    testMySite: vi.fn(() => Promise.resolve({ connected: true })),
    deleteMySite: vi.fn(),
    updateMyOrganization: vi.fn((input: { site_display_name?: string }) => Promise.resolve({
      id: 7,
      name: '华南分销',
      code: 'HN',
      username: 'south',
      status: 'active',
      site_display_name: input.site_display_name,
    })),
  },
  operatorApi: {
    list: () => mockOperatorList(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))

describe('SiteSettingsPage', () => {
  beforeEach(() => {
    mockSiteList.mockResolvedValue([])
    mockDistributorList.mockResolvedValue([])
    mockOperatorList.mockResolvedValue([])
    mockSettingsGet.mockResolvedValue({})
    mockMySites.mockResolvedValue([])
    mockMyOrganization.mockResolvedValue({
      id: 7,
      name: '华南分销',
      code: 'HN',
      username: 'south',
      status: 'active',
      site_display_name: '门店',
    })
  })

  it('shows operator management center sections', async () => {
    mockGetSessionUser.mockReturnValue({ id: 1, name: '总部', role: 'operator' })

    render(
      <MemoryRouter>
        <SiteSettingsPage />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('button', { name: '分销商管理' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '内部账号' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '系统配置' })).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('组织列表')).toBeInTheDocument()
    })
  })

  it('shows distributor self-service sections and terminology', async () => {
    mockGetSessionUser.mockReturnValue({ id: 7, name: '华南分销', role: 'distributor', distributorId: 7 })

    render(
      <MemoryRouter>
        <SiteSettingsPage />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('button', { name: '组织与账号' })).toBeInTheDocument()
    const siteTab = screen.getByRole('button', { name: '门店资产' })
    expect(siteTab).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '显示术语' })).toBeInTheDocument()

    fireEvent.click(siteTab)

    await waitFor(() => {
      expect(screen.getByText('我的门店')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '添加门店' })).toBeInTheDocument()
    })
  })
})
