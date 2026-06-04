import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { getResponsiveMetrics, scaleStyleDefinitions } from '../theme';

export default function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  tone = 'primary',
  icon = null,
  labelStyle = null,
  style = null,
}) {
  const { palette, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const metrics = useMemo(() => getResponsiveMetrics(width), [width]);
  const styles = useMemo(() => createStyles(palette, isDark, metrics), [palette, isDark, metrics]);
  const isPrimary = tone === 'primary';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        isPrimary ? styles.primary : styles.secondary,
        style,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading ? styles.pressed : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? palette.onAccent : palette.ink900} />
      ) : (
        <View style={styles.content}>
          {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
          <Text
            numberOfLines={2}
            style={[styles.label, isPrimary ? styles.primaryLabel : styles.secondaryLabel, labelStyle]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function createStyles(palette, isDark, metrics) {
  return StyleSheet.create(scaleStyleDefinitions({
    button: {
      minHeight: 56,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
      shadowColor: '#0F172A',
      shadowOpacity: isDark ? 0.16 : 0.08,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 7 },
      elevation: 3,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      width: '100%',
    },
    iconWrap: {
      width: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primary: {
      backgroundColor: palette.teal600,
    },
    secondary: {
      backgroundColor: isDark ? '#102A38' : '#F4FAFF',
      borderWidth: 1,
      borderColor: isDark ? '#2E5E6A' : '#C9DDED',
    },
    disabled: {
      opacity: 0.55,
    },
    pressed: {
      transform: [{ scale: 0.99 }],
    },
    label: {
      flexShrink: 1,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '900',
      letterSpacing: 0,
      textAlign: 'center',
    },
    primaryLabel: {
      color: palette.onAccent,
    },
    secondaryLabel: {
      color: palette.ink900,
    },
  }, metrics, { exclude: ['content.width'] }));
}
