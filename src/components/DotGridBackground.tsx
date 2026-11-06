import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';
import { journalTheme } from '../theme/journalTheme';

/** Decorativo: nunca recebe toques e não interfere na rolagem ou no teclado. */
export default function DotGridBackground() {
  return (
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" accessible={false}>
        <Defs>
          <Pattern id="dotJournalPaper" x="0" y="0" width="23" height="23" patternUnits="userSpaceOnUse">
            <Circle cx="11.5" cy="11.5" r="1" fill={journalTheme.colors.dot} opacity="0.58" />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#dotJournalPaper)" />
      </Svg>
    </View>
  );
}
