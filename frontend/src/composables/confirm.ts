import { ElMessageBox } from 'element-plus'

/** Resolves to true when the user confirms; dismissing the dialog resolves to false. */
export async function confirmAction (title: string, message: string, confirmText: string, danger = false): Promise<boolean> {
  try {
    await ElMessageBox.confirm(message, title, {
      confirmButtonText: confirmText,
      cancelButtonText: 'Отмена',
      type: danger ? 'warning' : 'info',
      confirmButtonClass: danger ? 'el-button--danger' : undefined
    })
    return true
  } catch {
    return false
  }
}

/** Asks for an optional text (e.g. a reason). Resolves to null when dismissed. */
export async function promptText (title: string, message: string, confirmText: string, placeholder = ''): Promise<string | null> {
  try {
    const { value } = await ElMessageBox.prompt(message, title, {
      confirmButtonText: confirmText,
      cancelButtonText: 'Отмена',
      inputPlaceholder: placeholder,
      inputType: 'textarea',
      inputValidator: (value) => (String(value || '').length <= 500 ? true : 'Не более 500 символов')
    })
    return String(value || '').trim()
  } catch {
    return null
  }
}
