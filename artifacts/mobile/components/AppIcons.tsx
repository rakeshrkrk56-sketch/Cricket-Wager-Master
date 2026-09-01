import React, { type ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type AppIconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

function IconCanvas({ size = 24, color = 'black', strokeWidth = 1.8, children }: AppIconProps & { children: ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityRole="image">
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<any>, {
              stroke: color,
              strokeWidth,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
            })
          : child,
      )}
    </Svg>
  );
}

export function HomeIcon(props: AppIconProps) {
  return (
    <IconCanvas {...props}>
      <Path d="M3.5 10.5 12 3.5l8.5 7v9a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1v-9Z" />
      <Path d="M9 20.5v-6h6v6" />
    </IconCanvas>
  );
}

export function WalletIcon(props: AppIconProps) {
  return (
    <IconCanvas {...props}>
      <Path d="M4 6.5h14a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v1" />
      <Path d="M20 11.5h-4a2 2 0 0 0 0 4h4" />
      <Circle cx="16" cy="13.5" r=".5" />
    </IconCanvas>
  );
}

export function BellIcon(props: AppIconProps) {
  return (
    <IconCanvas {...props}>
      <Path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
      <Path d="M10 21h4" />
    </IconCanvas>
  );
}

export function HeadsetIcon(props: AppIconProps) {
  return (
    <IconCanvas {...props}>
      <Path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <Path d="M4 14a2 2 0 0 1 2-2h1v6H6a2 2 0 0 1-2-2v-2Z" />
      <Path d="M20 14a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2v-2Z" />
      <Path d="M17 18c0 1.1-.9 2-2 2h-2" />
    </IconCanvas>
  );
}

export function ArrowLeftIcon(props: AppIconProps) {
  return (
    <IconCanvas {...props}>
      <Path d="M19 12H5" />
      <Path d="m12 19-7-7 7-7" />
    </IconCanvas>
  );
}

export function ChevronRightIcon(props: AppIconProps) {
  return (
    <IconCanvas {...props}>
      <Path d="m9 5 7 7-7 7" />
    </IconCanvas>
  );
}

export function PlayIcon(props: AppIconProps) {
  return (
    <IconCanvas {...props}>
      <Path d="m8 5 11 7-11 7V5Z" />
    </IconCanvas>
  );
}

export function FlashIcon(props: AppIconProps) {
  return (
    <IconCanvas {...props}>
      <Path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" />
    </IconCanvas>
  );
}

export function GameControllerIcon(props: AppIconProps) {
  return (
    <IconCanvas {...props}>
      <Path d="M7 8h10a4 4 0 0 1 3.8 2.8l1.1 4.1a3 3 0 0 1-5.7 1.8L15 15H9l-1.2 1.7a3 3 0 0 1-5.7-1.8l1.1-4.1A4 4 0 0 1 7 8Z" />
      <Path d="M7 11v4M5 13h4" />
      <Circle cx="16.5" cy="12.5" r=".5" />
      <Circle cx="18.5" cy="14.5" r=".5" />
    </IconCanvas>
  );
}

export function DiceIcon(props: AppIconProps) {
  return (
    <IconCanvas {...props}>
      <Rect x="4" y="4" width="16" height="16" rx="2" />
      <Circle cx="8" cy="8" r=".6" />
      <Circle cx="16" cy="16" r=".6" />
      <Circle cx="12" cy="12" r=".6" />
    </IconCanvas>
  );
}

export function ClockIcon(props: AppIconProps) {
  return (
    <IconCanvas {...props}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7v5l3 2" />
    </IconCanvas>
  );
}

export function PhoneLandscapeIcon(props: AppIconProps) {
  return (
    <IconCanvas {...props}>
      <Rect x="3" y="7" width="18" height="10" rx="2" />
      <Path d="M7 10v4M17 10v4" />
    </IconCanvas>
  );
}

export function VolumeIcon(props: AppIconProps) {
  return (
    <IconCanvas {...props}>
      <Path d="M4 10v4h3l5 4V6l-5 4H4Z" />
      <Path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
    </IconCanvas>
  );
}

export function VolumeMuteIcon(props: AppIconProps) {
  return (
    <IconCanvas {...props}>
      <Path d="M4 10v4h3l5 4V6l-5 4H4Z" />
      <Path d="m17 9 4 6M21 9l-4 6" />
    </IconCanvas>
  );
}

export function AddCircleIcon(props: AppIconProps) {
  return (
    <IconCanvas {...props}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 8v8M8 12h8" />
    </IconCanvas>
  );
}

export function DiamondIcon(props: AppIconProps) {
  return (
    <IconCanvas {...props}>
      <Path d="m12 3 8 9-8 9-8-9 8-9Z" />
    </IconCanvas>
  );
}

export function CheckCircleIcon(props: AppIconProps) {
  return (
    <IconCanvas {...props}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="m8.5 12 2.3 2.3 4.7-4.7" />
    </IconCanvas>
  );
}

export function LogoutIcon(props: AppIconProps) {
  return (
    <IconCanvas {...props}>
      <Path d="M10 17l5-5-5-5" />
      <Path d="M15 12H3" />
      <Path d="M21 19V5a2 2 0 0 0-2-2h-4" />
      <Path d="M15 21h4a2 2 0 0 0 2-2" />
    </IconCanvas>
  );
}

export function DepositIcon(props: AppIconProps) {
  return (
    <IconCanvas {...props}>
      <Path d="M4 6.5h14a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v1" />
      <Path d="M20 11.5h-4a2 2 0 0 0 0 4h4" />
      <Path d="M10 3.5v6M7 6.5h6" />
    </IconCanvas>
  );
}

export function WithdrawIcon(props: AppIconProps) {
  return (
    <IconCanvas {...props}>
      <Path d="M4 6.5h14a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v1" />
      <Path d="M20 11.5h-4a2 2 0 0 0 0 4h4" />
      <Path d="M10 3.5v6M7 6.5h6" />
      <Path d="M10 20.5v-6M7 17.5h6" />
    </IconCanvas>
  );
}

export function GiftIcon(props: AppIconProps) {
  return (
    <IconCanvas {...props}>
      <Rect x="4" y="9" width="16" height="11" rx="1.5" />
      <Path d="M3 9h18v4H3zM12 9v11" />
      <Path d="M12 9H8.5A2.5 2.5 0 1 1 11 6.5V9ZM12 9h3.5A2.5 2.5 0 1 0 13 6.5V9Z" />
    </IconCanvas>
  );
}

export function CopyIcon(props: AppIconProps) {
  return (
    <IconCanvas {...props}>
      <Rect x="8" y="4" width="12" height="14" rx="1.5" />
      <Path d="M16 4V3H6a2 2 0 0 0-2 2v12h2" />
    </IconCanvas>
  );
}

export function PhoneIcon(props: AppIconProps) {
  return (
    <IconCanvas {...props}>
      <Rect x="6" y="3" width="12" height="18" rx="2" />
      <Path d="M10 6h4M11 18h2" />
    </IconCanvas>
  );
}

export function BankIcon(props: AppIconProps) {
  return (
    <IconCanvas {...props}>
      <Path d="m3 9 9-5 9 5H3Z" />
      <Path d="M5 10v7M9 10v7M15 10v7M19 10v7M3 20h18M4 17h16" />
    </IconCanvas>
  );
}

export function DocumentIcon(props: AppIconProps) {
  return (
    <IconCanvas {...props}>
      <Path d="M6 3h8l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <Path d="M14 3v5h4M8 12h8M8 16h6" />
    </IconCanvas>
  );
}

export function InfoIcon(props: AppIconProps) {
  return (
    <IconCanvas {...props}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 11v5M12 8h.01" />
    </IconCanvas>
  );
}

export function ImageIcon(props: AppIconProps) {
  return (
    <IconCanvas {...props}>
      <Rect x="3" y="5" width="18" height="14" rx="2" />
      <Circle cx="8" cy="10" r="1.2" />
      <Path d="m4 17 5-5 3 3 2-2 6 5" />
    </IconCanvas>
  );
}