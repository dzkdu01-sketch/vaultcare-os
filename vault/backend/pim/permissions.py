from rest_framework.permissions import SAFE_METHODS, BasePermission


class DictionaryViewPermission(BasePermission):
    """
    字典治理权限：
    - 读取（GET/HEAD/OPTIONS）：任意已登录角色可访问
    - 写入（POST/PATCH/PUT/DELETE）：仅审核员(is_staff)或老板(is_superuser)
    """

    message = '当前角色仅可查看，无法编辑字典'

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        return bool(user and user.is_authenticated and (user.is_staff or user.is_superuser))
