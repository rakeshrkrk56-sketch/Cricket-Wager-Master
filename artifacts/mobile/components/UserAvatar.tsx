import React from 'react';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

export type AvatarChoice = 'male' | 'female';

interface UserAvatarProps {
  choice: AvatarChoice;
  size: number;
}

export function UserAvatar({ choice, size }: UserAvatarProps) {
  if (choice === 'female') {
    return (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx="50" cy="50" r="50" fill="#4B0B18" />
        <Circle cx="50" cy="43" r="26" fill="#2A1115" />
        <Path d="M18 100c2-24 14-36 32-36s30 12 32 36H18Z" fill="#D99B22" />
        <Path d="M29 43c0-17 9-29 21-29s22 12 22 29v23c-5-8-12-12-22-12S34 58 29 66V43Z" fill="#251014" />
        <Ellipse cx="50" cy="42" rx="17" ry="21" fill="#D99670" />
        <Path d="M34 37c3-15 11-20 22-18 8 1 14 7 16 17-9-1-17-5-23-11-3 6-8 10-15 12Z" fill="#251014" />
        <Circle cx="43" cy="43" r="1.6" fill="#321616" />
        <Circle cx="57" cy="43" r="1.6" fill="#321616" />
        <Path d="M44 52c4 3 8 3 12 0" fill="none" stroke="#8E3F40" strokeWidth="2" strokeLinecap="round" />
        <Path d="M39 68c7 7 15 7 22 0l5 7c-10 9-22 9-32 0l5-7Z" fill="#F7C957" />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx="50" cy="50" r="50" fill="#4B0B18" />
      <Path d="M16 100c3-24 15-36 34-36s31 12 34 36H16Z" fill="#B97816" />
      <Ellipse cx="50" cy="42" rx="19" ry="22" fill="#C9825D" />
      <Path d="M31 38c0-17 8-27 21-27 12 0 20 8 20 23-8-2-15-6-20-12-4 7-11 12-21 16Z" fill="#241316" />
      <Path d="M34 35c-2 17 4 29 16 30 12-1 19-12 17-30 3 5 4 11 2 18-3 12-10 19-19 19s-16-7-19-19c-2-7-1-13 3-18Z" fill="#3B2020" opacity="0.78" />
      <Circle cx="43" cy="43" r="1.6" fill="#321616" />
      <Circle cx="57" cy="43" r="1.6" fill="#321616" />
      <Path d="M44 52c4 3 8 3 12 0" fill="none" stroke="#7C3836" strokeWidth="2" strokeLinecap="round" />
      <Path d="M39 68c7 7 15 7 22 0l5 7c-10 9-22 9-32 0l5-7Z" fill="#F7C957" />
    </Svg>
  );
}