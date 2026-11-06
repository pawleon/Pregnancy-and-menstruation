// Read-only access to the currently selected SillyTavern persona and character.
import { power_user } from '../../../power-user.js';
import { user_avatar } from '../../../personas.js';
export function activeParentDescription(who='user') {
    try {
        if (who==='user') {
            const record=power_user?.persona_descriptions?.[user_avatar];
            return String(record?.description || power_user?.persona_description || '').slice(0,16000);
        }
        const ctx=SillyTavern?.getContext?.();
        if (ctx?.groupId !== undefined && ctx.groupId !== null) return '';
        const char=ctx?.characters?.[ctx?.characterId];
        return String(char?.data?.description || char?.description || '').slice(0,20000);
    } catch { return ''; }
}
