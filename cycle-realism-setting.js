// Persist the optional Cycle Realism setting in the current SillyTavern chat only.
// No global fallback and no writes to pregnancy/baby/cycle records.
export async function persistCycleRealism(context, metadataKey, checked, reportError = () => {}) {
    if (!context || !context.chatMetadata || typeof context.saveMetadata !== 'function' ||
        typeof checked !== 'boolean') return false;

    const metadata = context.chatMetadata;
    const previous = metadata[metadataKey];
    const oldRecord = previous && typeof previous === 'object' && !Array.isArray(previous)
        ? previous : {};
    if (oldRecord.realism === checked) return true;
    metadata[metadataKey] = { ...oldRecord, realism: checked };

    try {
        // Wait for async persistence: a checked box must not imply a failed save worked.
        await context.saveMetadata();
        return true;
    } catch (error) {
        // Roll back only this field, preserving any other chat options modified
        // while the save was in flight. Never touch another chat's metadata.
        const current = metadata[metadataKey];
        if (current && current.realism === checked) {
            const restored = { ...current };
            if (Object.prototype.hasOwnProperty.call(oldRecord, 'realism')) restored.realism = oldRecord.realism;
            else delete restored.realism;
            metadata[metadataKey] = restored;
        }
        reportError(error);
        return false;
    }
}
