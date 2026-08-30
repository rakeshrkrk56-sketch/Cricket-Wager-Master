import React, { type ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type AppIconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

function IconCanvas({ size = 24, color = 'currentColor', strokeWidth = 1.8, children }: AppIconProps & { children: ReactNode }) {
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