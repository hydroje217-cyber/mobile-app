import { createContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, Platform, findNodeHandle, useWindowDimensions } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getResponsiveMetrics, scaleStyleDefinitions } from '../theme';
import { StatusPill } from './UiControls';

export const KeyboardScrollContext = createContext({
  scrollToField: () => {},
});

export default function ScreenShell({
  eyebrow,
  title,
  subtitle,
  statusChips = [],
  statusChipsInline = false,
  headerActionIcon,
  headerActionLabel,
  headerActionBare = false,
  onHeaderActionPress,
  showMenuButton = false,
  onAccountEditPress,
  onTutorialPress,
  hideThemeToggle = false,
  showHeaderThemeToggle = false,
  children,
  scroll = true,
  keyboardAware = false,
  keyboardAwareProps,
  refreshing = false,
  onRefresh,
  scrollRef,
  onScroll,
  scrollEventThrottle,
  floatingOverlay,
}) {
  const { profile, signOut } = useAuth();
  const { palette, isDark, toggleTheme } = useTheme();
  const { width } = useWindowDimensions();
  const metrics = useMemo(() => getResponsiveMetrics(width), [width]);
  const styles = useMemo(() => createStyles(palette, isDark, metrics), [palette, isDark, metrics]);
  const keyboardScrollRef = useRef(null);
  const [accountOpen, setAccountOpen] = useState(false);

  const keyboardController = useMemo(
    () => ({
      scrollToField(target, extraHeight = 120) {
        if (!keyboardAware || !target) {
          return;
        }

        const nodeHandle = typeof target === 'number' ? target : findNodeHandle(target);
        if (!nodeHandle) {
          return;
        }

        const scrollApi =
          keyboardScrollRef.current?.props?.scrollToFocusedInput ||
          keyboardScrollRef.current?.scrollToFocusedInput;

        if (typeof scrollApi === 'function') {
          scrollApi(nodeHandle, extraHeight, 0);
        }
      },
    }),
    [keyboardAware]
  );

  const renderStatusChips = (style, pillSize = 'regular') =>
    statusChips.length ? (
      <View style={[styles.statusChipRow, style]}>
        {statusChips.map((chip) => (
          <StatusPill
            key={chip.key || chip.label}
            label={chip.label}
            iconName={chip.iconName}
            iconColor={chip.iconColor}
            tone={chip.tone}
            size={pillSize}
          />
        ))}
      </View>
    ) : null;
  const refreshControl = onRefresh ? (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={palette.teal600}
      colors={[palette.teal600]}
      progressBackgroundColor={palette.card}
    />
  ) : undefined;

  const header = (
    <View style={styles.headerBody}>
      {accountOpen ? (
        <Pressable
          accessibilityLabel="Close account details"
          onPress={() => setAccountOpen(false)}
          style={styles.accountDismissLayer}
        />
      ) : null}
      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <View style={[styles.heroIdentityGroup, headerActionBare && styles.heroIdentityGroupBare]}>
            {headerActionIcon && onHeaderActionPress ? (
              <Pressable
                onPress={onHeaderActionPress}
                accessibilityRole="button"
                accessibilityLabel={headerActionLabel || 'Header action'}
                style={({ pressed }) => [
                  styles.headerActionButton,
                  headerActionBare && styles.headerActionButtonBare,
                  pressed && styles.menuButtonPressed,
                ]}
              >
                <Ionicons name={headerActionIcon} size={headerActionBare ? 22 : 18} color={palette.cyan300} />
              </Pressable>
            ) : null}
            <View style={styles.heroCopy}>
              {eyebrow ? <Text numberOfLines={1} style={styles.eyebrow}>{eyebrow}</Text> : null}
              <View style={styles.titleRow}>
                <Text numberOfLines={1} style={[styles.title, statusChipsInline && styles.titleInline]}>{title}</Text>
                {statusChipsInline ? renderStatusChips(styles.statusChipRowInline, 'compact') : null}
              </View>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
          </View>
          {!statusChipsInline ? renderStatusChips(styles.statusChipRowHeader) : null}
          {showMenuButton ? (
            <View style={styles.headerControlRow}>
              {showHeaderThemeToggle && !hideThemeToggle ? (
                <PressableThemeToggle
                  isDark={isDark}
                  palette={palette}
                  onPress={toggleTheme}
                  styles={styles}
                />
              ) : null}
              <View style={styles.accountControlWrap}>
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation?.();
                    setAccountOpen((current) => !current);
                  }}
                  accessibilityLabel={accountOpen ? 'Close account details' : 'Open account details'}
                  style={({ pressed }) => [styles.accountIconButton, accountOpen && styles.accountIconButtonOpen, pressed && styles.menuButtonPressed]}
                >
                  <Ionicons name="person-circle-outline" size={20} color={palette.cyan300} />
                </Pressable>
                {accountOpen ? (
                  <View
                    style={styles.accountDropdown}
                    onStartShouldSetResponder={() => true}
                  >
                  <View style={styles.accountMenuHeader}>
                    <Text style={styles.accountEyebrow}>User details</Text>
                  </View>
                  <View style={styles.accountMenuTop}>
                    <View style={styles.accountAvatar}>
                      <Ionicons name="person-circle-outline" size={18} color={palette.cyan300} />
                    </View>
                    <View style={styles.accountCopy}>
                      <Text numberOfLines={1} style={styles.accountName}>{profile?.full_name || profile?.email || 'Office user'}</Text>
                      <Text numberOfLines={1} style={styles.accountEmail}>{profile?.email || '-'}</Text>
                    </View>
                    <View style={styles.accountRolePill}>
                      <Text style={styles.accountRoleText}>{profile?.role || 'user'}</Text>
                    </View>
                  </View>
                  <View style={styles.accountMenuDivider} />
                  {!hideThemeToggle && !showHeaderThemeToggle ? (
                    <PressableThemeToggle
                      isDark={isDark}
                      palette={palette}
                      onPress={toggleTheme}
                      styles={styles}
                      menuItem
                    />
                  ) : null}
                  {onTutorialPress ? (
                    <Pressable
                      onPress={() => {
                        setAccountOpen(false);
                        onTutorialPress();
                      }}
                      style={({ pressed }) => [styles.accountActionButton, styles.accountTutorialButton, pressed && styles.menuButtonPressed]}
                    >
                      <Ionicons name="school-outline" size={15} color={isDark ? '#A9EAF2' : '#0A6672'} />
                      <Text style={[styles.accountActionText, styles.accountTutorialText]}>Tutorial</Text>
                    </Pressable>
                  ) : null}
                  {onAccountEditPress ? (
                    <Pressable
                      onPress={() => {
                        setAccountOpen(false);
                        onAccountEditPress();
                      }}
                      style={({ pressed }) => [styles.accountActionButton, styles.accountEditButton, pressed && styles.menuButtonPressed]}
                    >
                      <Ionicons name="create-outline" size={15} color={isDark ? '#A9EAF2' : '#0A6672'} />
                      <Text style={[styles.accountActionText, styles.accountEditText]}>Edit account</Text>
                    </Pressable>
                  ) : null}
                  <Pressable onPress={signOut} style={({ pressed }) => [styles.accountActionButton, styles.accountSignOut, pressed && styles.menuButtonPressed]}>
                    <Ionicons name="log-out-outline" size={15} color={isDark ? '#F7CA72' : '#9A6700'} />
                    <Text style={[styles.accountActionText, styles.accountSignOutText]}>Sign out</Text>
                  </Pressable>
                  </View>
                ) : null}
              </View>
            </View>
          ) : !hideThemeToggle ? (
            <PressableThemeToggle
              isDark={isDark}
              palette={palette}
              onPress={toggleTheme}
              styles={styles}
            />
          ) : null}
        </View>
        {!statusChipsInline ? renderStatusChips(styles.statusChipRowBelow, 'compact') : null}
      </View>
    </View>
  );

  const content = (
    <KeyboardScrollContext.Provider value={keyboardController}>
      <View style={styles.body}>
        <Pressable
          disabled={!accountOpen}
          onPress={() => setAccountOpen(false)}
          style={styles.contentDismissWrap}
        >
          <View style={styles.content}>{children}</View>
        </Pressable>
      </View>
    </KeyboardScrollContext.Provider>
  );

  if (!scroll) {
    return (
      <View style={styles.container}>
        {header}
        {content}
        {floatingOverlay}
      </View>
    );
  }

  if (keyboardAware && Platform.OS !== 'web') {
    return (
      <View style={styles.container}>
        <KeyboardAwareScrollView
          style={styles.scroller}
          contentContainerStyle={styles.scrollContent}
          stickyHeaderIndices={[0]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          enableOnAndroid
          enableAutomaticScroll
          extraScrollHeight={72}
          extraHeight={96}
          keyboardOpeningTime={0}
          refreshControl={refreshControl}
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
          innerRef={(ref) => {
            keyboardScrollRef.current = ref;
            if (typeof scrollRef === 'function') {
              scrollRef(ref);
            } else if (scrollRef) {
              scrollRef.current = ref;
            }
            keyboardAwareProps?.innerRef?.(ref);
          }}
          {...keyboardAwareProps}
        >
          {header}
          {content}
        </KeyboardAwareScrollView>
        {floatingOverlay}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroller}
        contentContainerStyle={styles.scrollContent}
        stickyHeaderIndices={[0]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={refreshControl}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
      >
        {header}
        {content}
      </ScrollView>
      {floatingOverlay}
    </View>
  );
}

function PressableThemeToggle({ isDark, palette, onPress, styles, menuItem = false }) {
  const iconColor = menuItem ? palette.ink900 : palette.onAccent;
  const themeSwitchAnim = useRef(new Animated.Value(isDark ? 1 : 0)).current;
  const themeMoonScale = themeSwitchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const themeMoonRotate = themeSwitchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-90deg'],
  });
  const themeSunScale = themeSwitchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const themeSunRotate = themeSwitchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['90deg', '0deg'],
  });
  const themeIconBackground = themeSwitchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0.92)', 'rgba(15,23,42,0.88)'],
  });

  useEffect(() => {
    if (menuItem) {
      return;
    }

    Animated.timing(themeSwitchAnim, {
      toValue: isDark ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [isDark, menuItem, themeSwitchAnim]);

  if (!menuItem) {
    return (
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: isDark }}
        accessibilityLabel={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        onPress={onPress}
        style={({ pressed }) => [styles.themeSwitchWrap, pressed ? styles.themeSwitchPressed : null]}
      >
        <Animated.View style={[styles.themeIconToggle, { backgroundColor: themeIconBackground }]}>
          <Animated.View
            style={[
              styles.themeIconLayer,
              {
                transform: [{ rotate: themeMoonRotate }, { scale: themeMoonScale }],
              },
            ]}
          >
            <Ionicons name="moon" size={25} color="#1F2937" />
          </Animated.View>
          <Animated.View
            style={[
              styles.themeIconLayer,
              {
                transform: [{ rotate: themeSunRotate }, { scale: themeSunScale }],
              },
            ]}
          >
            <Ionicons name="sunny" size={26} color="#FACC15" />
          </Animated.View>
        </Animated.View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.themeToggle,
        menuItem && styles.themeToggleMenuItem,
        pressed && styles.themeTogglePressed,
      ]}
    >
      <View style={[styles.themeToggleContent, menuItem && styles.themeToggleContentMenuItem]}>
        <Ionicons
          name={isDark ? 'sunny-outline' : 'moon-outline'}
          size={menuItem ? 15 : 14}
          color={iconColor}
        />
        <Text style={[styles.themeToggleText, menuItem && styles.themeToggleTextMenuItem]}>
          {isDark ? 'Light' : 'Dark'}
        </Text>
      </View>
    </Pressable>
  );
}

function createStyles(palette, isDark, metrics) {
  return StyleSheet.create(scaleStyleDefinitions({
    container: {
      flex: 1,
      backgroundColor: palette.canvas,
    },
    scroller: {
      flex: 1,
      backgroundColor: palette.canvas,
    },
    scrollContent: {
      flexGrow: 1,
    },
    body: {
      flex: 1,
      width: '100%',
      maxWidth: metrics.contentMaxWidth,
      alignSelf: 'center',
    },
    headerBody: {
      width: '100%',
      maxWidth: metrics.contentMaxWidth,
      alignSelf: 'center',
      flexShrink: 0,
      zIndex: 2000,
      elevation: 2000,
    },
    hero: {
      paddingTop: 8,
      paddingHorizontal: metrics.contentPadding,
      paddingBottom: 10,
      backgroundColor: palette.navy900,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.08)',
      overflow: 'visible',
      zIndex: 300,
      elevation: 300,
    },
    accountDismissLayer: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: 250,
      elevation: 250,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: metrics.isTablet ? 10 : 12,
      zIndex: 400,
      elevation: 400,
    },
    heroIdentityGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      maxWidth: metrics.isTablet ? 270 : undefined,
    },
    heroIdentityGroupBare: {
      gap: 8,
    },
    menuButtonPressed: {
      transform: [{ scale: 0.98 }],
    },
    heroCopy: {
      flexShrink: 1,
      minWidth: 0,
      justifyContent: 'center',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minWidth: 0,
    },
    headerActionButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: isDark ? '#294C68' : 'rgba(191,212,231,0.8)',
      backgroundColor: isDark ? '#19324A' : 'rgba(248,252,255,0.08)',
      borderRadius: 8,
    },
    headerActionButtonBare: {
      width: 26,
      height: 34,
      borderWidth: 0,
      backgroundColor: 'transparent',
      borderRadius: 0,
    },
    eyebrow: {
      color: palette.cyan300,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: 3,
    },
    title: {
      color: palette.onAccent,
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '800',
    },
    titleInline: {
      flexShrink: 1,
    },
    subtitle: {
      marginTop: 4,
      color: palette.heroSubtitle,
      fontSize: 12,
      lineHeight: 17,
    },
    statusChipRow: {
      flexDirection: 'row',
      flexWrap: 'nowrap',
      gap: 4,
    },
    statusChipRowHeader: {
      position: 'relative',
      display: metrics.isTablet ? 'flex' : 'none',
      flexShrink: 0,
      justifyContent: 'flex-end',
      marginLeft: 'auto',
      marginRight: 2,
      zIndex: 1,
      elevation: 1,
    },
    statusChipRowBelow: {
      display: metrics.isTablet ? 'none' : 'flex',
      justifyContent: 'flex-start',
      alignSelf: 'flex-start',
      marginTop: 8,
      marginLeft: metrics.contentPadding + 34,
      maxWidth: '80%',
    },
    statusChipRowInline: {
      flexShrink: 0,
      gap: 3,
    },
    headerControlRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexShrink: 0,
    },
    accountControlWrap: {
      position: 'relative',
      zIndex: 1200,
      elevation: 1200,
    },
    accountIconButton: {
      width: 38,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: isDark ? '#294C68' : 'rgba(191,212,231,0.8)',
      backgroundColor: isDark ? '#19324A' : 'rgba(248,252,255,0.08)',
      borderRadius: 10,
    },
    accountIconButtonOpen: {
      borderColor: palette.cyan300,
      backgroundColor: isDark ? '#1D4A63' : 'rgba(103,232,249,0.12)',
    },
    accountDropdown: {
      position: 'absolute',
      top: 44,
      right: 0,
      width: metrics.isTablet ? 310 : 268,
      borderWidth: 1,
      borderColor: isDark ? '#2B5877' : 'rgba(191,212,231,0.92)',
      backgroundColor: isDark ? palette.card : '#F8FCFF',
      padding: 10,
      borderRadius: 8,
      gap: 8,
      shadowColor: '#000000',
      shadowOpacity: isDark ? 0.24 : 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 10 },
      elevation: 1300,
      zIndex: 1300,
    },
    accountMenuTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      minHeight: 32,
    },
    accountMenuHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    accountAvatar: {
      width: 30,
      height: 30,
      marginTop: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: isDark ? '#1E5B70' : '#B8DDF0',
      backgroundColor: isDark ? '#1C4257' : '#EAF8FF',
      borderRadius: 8,
    },
    accountCopy: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
    },
    accountEyebrow: {
      color: palette.ink500,
      fontSize: 9,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    accountName: {
      marginTop: 2,
      color: palette.ink900,
      fontSize: 12,
      fontWeight: '900',
    },
    accountEmail: {
      marginTop: 1,
      color: palette.ink500,
      fontSize: 9,
      fontWeight: '700',
    },
    accountRolePill: {
      alignSelf: 'center',
      marginTop: 0,
      borderWidth: 1,
      borderColor: isDark ? '#1D8C91' : '#8ADCD6',
      backgroundColor: isDark ? '#0F3A35' : '#E5F8F6',
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 999,
      maxWidth: 88,
    },
    accountRoleText: {
      color: palette.ink900,
      fontSize: 8,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    accountMenuDivider: {
      height: 1,
      backgroundColor: isDark ? 'rgba(255,255,255,0.09)' : '#D8E4F0',
    },
    accountActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 8,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 8,
      minHeight: 38,
      borderRadius: 9,
      width: '100%',
    },
    accountSignOut: {
      borderColor: isDark ? '#8A6514' : '#F7D6A7',
      backgroundColor: isDark ? '#33240B' : '#FFF5E8',
    },
    accountEditButton: {
      borderColor: isDark ? '#276A77' : '#A5DCE5',
      backgroundColor: isDark ? '#102F3A' : '#EAFBFF',
    },
    accountTutorialButton: {
      borderColor: isDark ? '#1D8C91' : '#8ADCD6',
      backgroundColor: isDark ? '#0F3A35' : '#E5F8F6',
    },
    accountActionText: {
      fontSize: 11,
      fontWeight: '900',
    },
    accountTutorialText: {
      color: isDark ? '#A9EAF2' : '#0A6672',
    },
    accountEditText: {
      color: isDark ? '#A9EAF2' : '#0A6672',
    },
    accountSignOutText: {
      color: isDark ? '#F7CA72' : '#9A6700',
    },
    themeSwitchWrap: {
      width: 46,
      height: 46,
      alignItems: 'center',
      justifyContent: 'center',
    },
    themeSwitchPressed: {
      transform: [{ scale: 0.97 }],
    },
    themeIconToggle: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(250, 204, 21, 0.32)' : 'rgba(255, 255, 255, 0.78)',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.22 : 0.1,
      shadowRadius: 16,
      elevation: 8,
    },
    themeIconLayer: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    themeToggle: {
      height: 32,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.14)',
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.06)',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 0,
      minWidth: 72,
      alignItems: 'center',
      justifyContent: 'center',
    },
    themeToggleMenuItem: {
      height: 38,
      width: '100%',
      borderColor: isDark ? '#1D8C91' : '#8ADCD6',
      backgroundColor: isDark ? '#0F3A35' : '#E5F8F6',
      borderRadius: 9,
    },
    themeTogglePressed: {
      transform: [{ scale: 0.98 }],
    },
    themeToggleContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    themeToggleContentMenuItem: {
      width: '100%',
      justifyContent: 'flex-start',
      paddingHorizontal: 4,
      gap: 8,
    },
    themeToggleText: {
      color: palette.onAccent,
      fontSize: 11,
      fontWeight: '700',
    },
    themeToggleTextMenuItem: {
      color: palette.ink900,
      fontSize: 11,
      fontWeight: '900',
    },
    content: {
      padding: metrics.contentPadding,
      gap: metrics.contentGap,
    },
    contentDismissWrap: {
      flex: 1,
    },
  }, metrics, {
    exclude: [
      'body.width',
      'body.maxWidth',
      'body.alignSelf',
      'headerBody.width',
      'headerBody.maxWidth',
      'headerBody.alignSelf',
      'headerBody.flexShrink',
      'headerBody.zIndex',
      'headerBody.elevation',
      'content.padding',
      'content.gap',
      'hero.paddingHorizontal',
      'contentDismissWrap.flex',
    ],
  }));
}
