import { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { getResponsiveMetrics, scaleStyleDefinitions } from '../theme';

export default function Card({ children, style }) {
  const { palette, shadows, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const metrics = useMemo(() => getResponsiveMetrics(width), [width]);
  const styles = useMemo(() => createStyles(palette, shadows, isDark, metrics), [palette, shadows, isDark, metrics]);

  return <View style={[styles.card, style]}>{children}</View>;
}

function createStyles(palette, shadows, isDark, metrics) {
  return StyleSheet.create(scaleStyleDefinitions({
    card: {
      backgroundColor: palette.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: isDark ? '#243B52' : '#D7E4F0',
      padding: 16,
      shadowColor: shadows.card.shadowColor || '#0F172A',
      shadowOpacity: isDark ? 0.16 : 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
  }, metrics));
}
