import apiService from "./api.service"

export type AccessMenu = {
  id: number
  code: string
  label: string
  path: string
  sortOrder: number
}

export type AccessRole = {
  id: number
  code: string
  name: string
  description?: string | null
}

export type AccessMatrix = {
  roles: AccessRole[]
  menus: AccessMenu[]
  permissions: Record<string, string[]>
}

type ApiAccessMenu = Omit<AccessMenu, "sortOrder"> & {
  sort_order?: number
  sortOrder?: number
}

const normalizeMenu = (menu: ApiAccessMenu): AccessMenu => ({
  id: menu.id,
  code: menu.code,
  label: menu.label,
  path: menu.path,
  sortOrder: menu.sortOrder ?? menu.sort_order ?? 0,
})

class AccessControlService {
  async getMyMenus(): Promise<{ success: boolean; message: string; data: AccessMenu[] }> {
    const response = await apiService.get<{ success: boolean; message: string; data: ApiAccessMenu[] }>("/access-control/me/menus")
    return { ...response, data: response.data.map(normalizeMenu) }
  }

  async getMatrix(): Promise<{ success: boolean; message: string; data: AccessMatrix }> {
    const response = await apiService.get<{ success: boolean; message: string; data: { roles: AccessRole[]; menus: ApiAccessMenu[]; permissions: Record<string, string[]> } }>("/access-control/matrix")
    return {
      ...response,
      data: {
        ...response.data,
        menus: response.data.menus.map(normalizeMenu),
      },
    }
  }

  async updateRoleMenus(roleCode: string, menuCodes: string[]): Promise<{ success: boolean; message: string }> {
    return apiService.put<{ success: boolean; message: string }>(`/access-control/roles/${roleCode}/menus`, { menuCodes })
  }
}

export const accessControlService = new AccessControlService()
export default accessControlService
