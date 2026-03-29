import { getPlatformIcon } from "../utils/platform";

interface Props {
  platformId: string;
  size?: number;
}

export function PlatformIcon({ platformId, size = 16 }: Props) {
  const icon = getPlatformIcon(platformId);
  return (
    <span
      aria-label={platformId}
      style={{ fontSize: `${size}px`, lineHeight: 1 }}
    >
      {icon}
    </span>
  );
}
