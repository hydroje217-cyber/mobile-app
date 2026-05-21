import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import FormField from '../components/FormField';
import MessageBanner from '../components/MessageBanner';
import PrimaryButton from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getResponsiveMetrics, scaleStyleDefinitions } from '../theme';

export default function AuthScreen({ initialMessage = '', initialTone = 'info' }) {
  const { signIn, signUp, requestPasswordReset, authMessage } = useAuth();
  const { palette, isDark, toggleTheme } = useTheme();
  const { width, height } = useWindowDimensions();
  const responsiveMetrics = useMemo(() => getResponsiveMetrics(width), [width]);
  const styles = useMemo(() => createStyles(palette, isDark, responsiveMetrics, height), [palette, isDark, responsiveMetrics, height]);
  const useMobileLoginCard = width < 900;
  const useFocusOverlay = width < 620;
  const overlayInputRef = useRef(null);
  const isSwitchingOverlayField = useRef(false);
  const themeSwitchAnim = useRef(new Animated.Value(isDark ? 1 : 0)).current;
  const [mode, setMode] = useState('sign-in');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState('');
  const [overlayField, setOverlayField] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [message, setMessage] = useState(initialMessage || authMessage || '');
  const [tone, setTone] = useState(initialMessage ? initialTone : 'info');
  const [loading, setLoading] = useState(false);
  const overlayValue = overlayField === 'fullName' ? fullName : overlayField === 'email' ? email : password;
  const overlayLabel = overlayField === 'fullName' ? 'Full name' : overlayField === 'email' ? 'Email' : 'Password';
  const overlayPlaceholder =
    overlayField === 'fullName'
      ? 'Enter your full name'
      : overlayField === 'email'
        ? 'Enter your work email'
        : 'Minimum 6 characters';
  const focusPanelBottom = keyboardHeight
    ? keyboardHeight + (overlayField === 'password' ? 58 : 28)
    : 300;
  const themeMoonScale = themeSwitchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const themeMoonRotate = themeSwitchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const themeSunScale = themeSwitchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const themeSunRotate = themeSwitchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const themeIconBackground = themeSwitchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#FFFFFF', '#111827'],
  });

  useEffect(() => {
    if (!overlayField) {
      return undefined;
    }

    const focusTimer = setTimeout(() => {
      overlayInputRef.current?.focus();
    }, 80);

    return () => clearTimeout(focusTimer);
  }, [overlayField]);

  useEffect(() => {
    const keyboardShowSubscription = Keyboard.addListener('keyboardDidShow', ({ endCoordinates }) => {
      setKeyboardHeight(endCoordinates.height);
    });
    const keyboardHideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      if (isSwitchingOverlayField.current) {
        return;
      }

      setKeyboardHeight(0);
      closeOverlayField();
    });

    return () => {
      keyboardShowSubscription.remove();
      keyboardHideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    Animated.timing(themeSwitchAnim, {
      toValue: isDark ? 1 : 0,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [isDark, themeSwitchAnim]);

  useEffect(() => {
    if (!message) {
      return undefined;
    }

    const dismissTimer = setTimeout(() => {
      setMessage('');
    }, 3000);

    return () => clearTimeout(dismissTimer);
  }, [message]);

  async function handleSubmit() {
    setLoading(true);

    const action =
      mode === 'sign-in'
        ? await signIn({ email: email.trim(), password })
        : await signUp({ email: email.trim(), password, fullName: fullName.trim() });

    setLoading(false);
    setTone(action.ok ? 'success' : 'error');
    setMessage(action.message || (action.ok ? 'Success.' : 'Unable to continue.'));
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setTone('error');
      setMessage('Enter your email first so we know where to send the password reset link.');
      return;
    }

    setLoading(true);
    const action = await requestPasswordReset({ email: email.trim() });
    setLoading(false);
    setTone(action.ok ? 'success' : 'error');
    setMessage(action.message || (action.ok ? 'Password reset email sent.' : 'Unable to send reset email.'));
  }

  function openOverlayField(fieldName) {
    setFocusedField(fieldName);
    setOverlayField(fieldName);
  }

  function closeOverlayField() {
    setFocusedField('');
    setOverlayField('');
  }

  function handleOverlayChangeText(value) {
    if (overlayField === 'fullName') {
      setFullName(value);
      return;
    }

    if (overlayField === 'email') {
      setEmail(value);
      return;
    }

    setPassword(value);
  }

  function moveOverlayTo(fieldName) {
    isSwitchingOverlayField.current = true;
    openOverlayField(fieldName);

    setTimeout(() => {
      overlayInputRef.current?.focus();
      isSwitchingOverlayField.current = false;
    }, 80);
  }

  function handleOverlaySubmit() {
    if (overlayField === 'fullName') {
      moveOverlayTo('email');
      return;
    }

    if (overlayField === 'email') {
      moveOverlayTo('password');
      return;
    }

    closeOverlayField();
    handleSubmit();
  }

  function renderMobileInput(fieldName, label, displayValue, placeholder, options = {}) {
    const isPasswordField = fieldName === 'password';

    return (
      <>
        <Text style={styles.mobileInputLabel}>{label}</Text>
        <Pressable
          onPress={() => openOverlayField(fieldName)}
          style={[
            styles.mobileInputShell,
            displayValue ? styles.mobileInputShellFilled : null,
            focusedField === fieldName ? styles.mobileInputShellFocused : null,
          ]}
        >
          <Text
            numberOfLines={1}
            style={[styles.mobileInputText, !displayValue ? styles.mobileInputPlaceholder : null]}
          >
            {isPasswordField && displayValue && !showPassword ? '********' : displayValue || placeholder}
          </Text>
          {options.trailingIcon ? <View style={styles.mobileInputTrailing}>{options.trailingIcon}</View> : null}
        </Pressable>
      </>
    );
  }

  const loginOverlay = useFocusOverlay && overlayField ? (
    <View style={styles.focusOverlay}>
      <Pressable onPress={closeOverlayField} style={styles.focusOverlayBackdrop} />
      <View pointerEvents="box-none" style={styles.focusPanelWrapper}>
        <View style={[styles.focusPanel, { bottom: focusPanelBottom }]}>
          <Text style={styles.focusLabel}>{overlayLabel}</Text>
          <View style={styles.focusInputShell}>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              blurOnSubmit={overlayField === 'password'}
              key={overlayField}
              keyboardType={overlayField === 'email' ? 'email-address' : 'default'}
              onChangeText={handleOverlayChangeText}
              onSubmitEditing={handleOverlaySubmit}
              placeholder={overlayPlaceholder}
              placeholderTextColor={isDark ? '#91A4B8' : '#64748B'}
              ref={overlayInputRef}
              returnKeyType={overlayField === 'password' ? 'done' : 'next'}
              secureTextEntry={overlayField === 'password' && !showPassword}
              style={styles.focusInput}
              textContentType={overlayField === 'password' ? 'password' : overlayField === 'email' ? 'username' : 'name'}
              value={overlayValue}
            />
            {overlayField === 'password' ? (
              <Pressable
                onPress={() => setShowPassword((current) => !current)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                hitSlop={8}
                style={styles.focusInputAction}
              >
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color={palette.ink500} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  ) : null;

  return (
    <View style={styles.authRoot}>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: isDark }}
        accessibilityLabel={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        onPress={toggleTheme}
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
      <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        style={styles.authScroller}
        contentContainerStyle={styles.authScrollContent}
      >
        <View style={styles.authContent}>
          {useMobileLoginCard ? (
            <View style={styles.mobileHero}>
              <Image
                resizeMode="cover"
                source={require('../../assets/background2.png')}
                style={styles.mobileHeroImage}
              />
              <View style={styles.mobileHeroOverlay} />
              <View style={styles.mobileHeroContent}>
                <View style={styles.mobileBrandMark}>
                  <Image
                    resizeMode="contain"
                    source={require('../../assets/icon-logo.png')}
                    style={styles.mobileBrandImage}
                  />
                </View>
                <Text style={styles.mobileLoginTitle}>NemeXus Monitoring</Text>
                <Text style={styles.mobileLoginSubtitle}>Manager, supervisor, and general manager access</Text>
              </View>
            </View>
          ) : (
            <View style={styles.desktopBrandBlock}>
              <Image
                resizeMode="contain"
                source={require('../../assets/icon-logo.png')}
                style={styles.desktopBrandImage}
              />
              <Text style={styles.desktopTitle}>NemeXus Monitoring</Text>
              <Text style={styles.desktopSubtitle}>Manager, supervisor, and general manager access</Text>
            </View>
          )}

          {message ? (
            <View style={styles.messageWrap}>
              <MessageBanner tone={tone}>{message}</MessageBanner>
            </View>
          ) : null}

          <View
            style={[
              styles.formPanel,
              useMobileLoginCard ? styles.mobileFormPanel : styles.desktopFormPanel,
              useMobileLoginCard && !useFocusOverlay ? styles.tabletInlineFormPanel : null,
              mode === 'sign-up' ? styles.signUpFormPanel : null,
              useFocusOverlay && overlayField ? styles.mobileFormPanelHidden : null,
            ]}
          >
            {mode === 'sign-up' ? (
              useFocusOverlay ? (
                renderMobileInput('fullName', 'Full name', fullName, 'Enter your full name')
              ) : (
                <FormField
                  label="Full name"
                  value={fullName}
                  onChangeText={setFullName}
                  icon={<Ionicons name="person-outline" size={18} color={palette.ink500} />}
                />
              )
            ) : null}
            {useFocusOverlay ? (
              renderMobileInput('email', 'Email', email, 'Enter your work email')
            ) : (
              <FormField
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                icon={<Ionicons name="mail-outline" size={18} color={palette.ink500} />}
              />
            )}
            {useFocusOverlay ? (
              renderMobileInput('password', 'Password', password, 'Minimum 6 characters', {
                trailingIcon: (
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation?.();
                      setShowPassword((current) => !current);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    hitSlop={8}
                  >
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color={palette.ink500} />
                  </Pressable>
                ),
              })
            ) : (
              <FormField
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="Minimum 6 characters"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                icon={<Ionicons name="key-outline" size={18} color={palette.ink500} />}
                trailingIcon={
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={19}
                    color={palette.ink500}
                  />
                }
                onPressTrailingIcon={() => setShowPassword((current) => !current)}
                trailingAccessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              />
            )}

            {mode === 'sign-in' ? (
              <Pressable onPress={handleForgotPassword} style={styles.forgotWrap}>
                <View style={styles.forgotRow}>
                  <Ionicons name="help-circle-outline" size={15} color={palette.teal600} />
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </View>
              </Pressable>
            ) : null}

            <View style={mode === 'sign-up' ? styles.signUpSubmitWrap : null}>
              <PrimaryButton
                label={mode === 'sign-in' ? 'Sign in' : 'Create account'}
                onPress={handleSubmit}
                loading={loading}
                disabled={!email.trim() || !password.trim() || (mode === 'sign-up' && !fullName.trim())}
                icon={
                  <Ionicons
                    name={mode === 'sign-in' && useMobileLoginCard ? 'shield-checkmark-outline' : mode === 'sign-in' ? 'arrow-forward-circle-outline' : 'checkmark-circle-outline'}
                    size={18}
                    color={palette.onAccent}
                  />
                }
              />
            </View>

            <Pressable
              onPress={() => {
                closeOverlayField();
                setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
              }}
            >
            <View style={styles.toggleRow}>
                <Ionicons name="swap-horizontal-outline" size={16} color={palette.navy700} />
                <Text style={styles.toggleText}>
                  {mode === 'sign-in'
                    ? 'Need an account? Switch to sign up'
                    : 'Already have an account? Switch to sign in'}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      {loginOverlay}
    </View>
  );
}

function createStyles(palette, isDark, responsiveMetrics, screenHeight) {
  const mobileHeroHeight = Math.round(Math.min(Math.max(screenHeight * 0.42, 300), 390));

  return StyleSheet.create(scaleStyleDefinitions({
    authRoot: {
      flex: 1,
      backgroundColor: palette.canvas,
      position: 'relative',
    },
    themeSwitchWrap: {
      position: 'absolute',
      top: 16,
      right: 16,
      zIndex: 3000,
      elevation: 3000,
    },
    themeSwitchPressed: {
      transform: [{ scale: 0.97 }],
    },
    themeIconToggle: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(250, 204, 21, 0.32)' : 'rgba(255, 255, 255, 0.78)',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.26 : 0.12,
      shadowRadius: 18,
      elevation: 8,
    },
    themeIconLayer: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    authScroller: {
      flex: 1,
      backgroundColor: isDark ? '#0D1A28' : palette.canvas,
    },
    authScrollContent: {
      flexGrow: 1,
      paddingBottom: 0,
    },
    authContent: {
      flexGrow: 1,
      width: '100%',
      alignSelf: 'center',
      maxWidth: responsiveMetrics.width >= 900 ? 520 : undefined,
      backgroundColor: isDark ? '#172B3A' : palette.card,
    },
    desktopBrandBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
      paddingBottom: 18,
      paddingTop: 56,
    },
    desktopBrandImage: {
      height: 92,
      width: 92,
      marginBottom: 14,
    },
    desktopTitle: {
      color: palette.ink900,
      fontSize: 26,
      fontWeight: '900',
      textAlign: 'center',
    },
    desktopSubtitle: {
      color: palette.ink700,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 20,
      marginTop: 6,
      textAlign: 'center',
    },
    messageWrap: {
      paddingHorizontal: 22,
      paddingTop: 18,
    },
    formPanel: {
      width: '100%',
      alignSelf: 'center',
    },
    mobileHero: {
      alignItems: 'center',
      backgroundColor: palette.navy900,
      height: mobileHeroHeight,
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'relative',
    },
    mobileHeroImage: {
      height: '100%',
      left: 0,
      opacity: isDark ? 0.34 : 0.24,
      position: 'absolute',
      top: 0,
      width: '100%',
    },
    mobileHeroOverlay: {
      backgroundColor: isDark ? 'rgba(7, 19, 31, 0.68)' : 'rgba(17, 35, 59, 0.78)',
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    mobileHeroContent: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    mobileBrandMark: {
      width: 132,
      height: 132,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    mobileBrandImage: {
      width: '100%',
      height: '100%',
    },
    mobileLoginTitle: {
      color: palette.onAccent,
      fontSize: 23,
      lineHeight: 29,
      fontWeight: '900',
      textAlign: 'center',
    },
    mobileLoginSubtitle: {
      marginTop: 6,
      color: palette.heroSubtitle,
      fontSize: 13,
      lineHeight: 17,
      fontWeight: '700',
      textAlign: 'center',
    },
    mobileFormPanel: {
      maxWidth: responsiveMetrics.isTablet ? 760 : undefined,
      paddingBottom: responsiveMetrics.isTablet ? 22 : 12,
      paddingHorizontal: responsiveMetrics.isTablet ? 34 : 22,
      paddingTop: responsiveMetrics.isTablet ? 34 : 42,
    },
    tabletInlineFormPanel: {
      gap: 16,
    },
    signUpFormPanel: {
      paddingTop: responsiveMetrics.isTablet ? 28 : 24,
    },
    signUpSubmitWrap: {
      marginTop: responsiveMetrics.isTablet ? 2 : 14,
    },
    desktopFormPanel: {
      paddingBottom: 16,
      paddingHorizontal: 30,
      paddingTop: 28,
      gap: 14,
    },
    mobileFormPanelHidden: {
      opacity: 0,
    },
    mobileInputLabel: {
      color: palette.ink900,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.4,
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    mobileInputShell: {
      backgroundColor: isDark ? '#0C1621' : '#F9FCFF',
      borderColor: palette.line,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
      paddingHorizontal: 16,
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isDark ? 0 : 0.06,
      shadowRadius: 12,
      elevation: 2,
    },
    mobileInputShellFocused: {
      backgroundColor: palette.card,
      borderColor: palette.teal600,
      shadowOpacity: isDark ? 0.14 : 0.11,
    },
    mobileInputShellFilled: {
      borderColor: isDark ? '#29465C' : '#D7E0EA',
    },
    mobileInputText: {
      color: palette.ink900,
      flex: 1,
      fontSize: 15,
      fontWeight: '800',
      minHeight: 52,
      paddingVertical: 16,
    },
    mobileInputPlaceholder: {
      color: palette.ink500,
      fontWeight: '700',
    },
    mobileInputTrailing: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
      width: 34,
    },
    forgotWrap: {
      alignSelf: 'flex-end',
      marginBottom: 14,
    },
    forgotRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    forgotText: {
      color: palette.teal600,
      fontSize: 13,
      fontWeight: '700',
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 12,
    },
    toggleText: {
      color: isDark ? palette.cyan300 : palette.navy700,
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'center',
    },
    focusOverlay: {
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: 5000,
      elevation: 5000,
    },
    focusOverlayBackdrop: {
      backgroundColor: isDark ? 'rgba(23, 43, 58, 0.72)' : 'rgba(15, 23, 42, 0.68)',
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    focusPanelWrapper: {
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    focusPanel: {
      alignSelf: 'center',
      position: 'absolute',
      width: '86%',
      maxWidth: 360,
    },
    focusLabel: {
      color: palette.onAccent,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.4,
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    focusInputShell: {
      alignItems: 'center',
      backgroundColor: isDark ? '#1E3547' : palette.card,
      borderColor: isDark ? '#426277' : palette.card,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row',
      paddingHorizontal: 16,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.28 : 0.24,
      shadowRadius: 18,
      elevation: 8,
    },
    focusInput: {
      backgroundColor: 'transparent',
      color: palette.ink900,
      flex: 1,
      fontSize: 16,
      fontWeight: '800',
      minHeight: 54,
      paddingHorizontal: 0,
      paddingVertical: 12,
    },
    focusInputAction: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 54,
      width: 34,
    },
  }, responsiveMetrics));
}
