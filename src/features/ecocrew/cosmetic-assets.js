import leafFrameUrl from '../../assets/leaf_frame.png';

const cosmeticAssetUrls = Object.freeze({
  'leaf-frame': leafFrameUrl,
});

export function getCosmeticAsset(cosmeticId) {
  return cosmeticAssetUrls[cosmeticId] || null;
}

export function getProfileFrameId(profile) {
  return profile?.frameId ?? profile?.frame_id ?? null;
}
