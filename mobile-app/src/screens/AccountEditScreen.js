import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Card from '../components/Card';
import FormField from '../components/FormField';
import MessageBanner from '../components/MessageBanner';
import PrimaryButton from '../components/PrimaryButton';
import ScreenShell from '../components/ScreenShell';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getResponsiveMetrics, scaleStyleDefinitions } from '../theme';

export default function AccountEditScreen({ navigation }) {
  const { profile, updateAccountCredentials } = useAuth();
  const { palette, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const responsiveMetrics = useMemo(() => getResponsiveMetrics(width), [width]);
  const styles = useMemo(() => createStyles(palette, isDark, responsiveMetrics), [palette, isDark, responsiveMetrics]);
  const [email, setEmail] = useState(profile?.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState('info');
  const [loading, setLoading] = useState(false);

  const emailChanged = email.trim() && email.trim() !== profile?.email;
  const passwordEntered = Boolean(password.trim() || confirmPassword.trim());
  const canSave = Boolean(emailChanged || passwordEntered);
  const displayName = profile?.full_name || profile?.email || 'Account user';

  async function handleSave() {
    if (passwordEntered && password !== confirmPassword) {
      setTone('error');
      setMessage('Passwords must match before saving.');
      return;
    }

    setLoading(true);
    const action = await updateAccountCredentials({
      email: email.trim(),
      password: password.trim() ? password : '',
    });
    setLoading(false);
    setTone(action.ok ? 'success' : 'error');
    setMessage(action.message || (action.ok ? 'Account updated.' : 'Unable to update account.'));

    if (action.ok) {
      setPassword('');
      setConfirmPassword('');
    }
  }

  return (
    <ScreenShell
      title="Edit Account"
      subtitle={`${displayName} · ${profile?.email || '-'}`}
      headerActionIcon="arrow-back-outline"
      headerActionLabel="Back"
      headerActionBare
      onHeaderActionPress={navigation.goBack}
      keyboardAware
      keyboardAwareProps={{
        keyboardOpeningTime: 0,
        extraScrollHeight: 84,
        extraHeight: 120,
        enableAutomaticScroll: true,
      }}
    >
      <Card>
        <View style={styles.cardTitleRow}>
          <View style={styles.cardIconWrap}>
            <Ionicons name="person-circle-outline" size={18} color={palette.ink900} />
          </View>
          <View style={styles.cardCopy}>
            <Text numberOfLines={1} style={styles.cardTitle}>{displayName}</Text>
            <Text numberOfLines={1} style={styles.cardBody}>{profile?.email || '-'}</Text>
          </View>
          <View style={styles.rolePill}>
            <Text style={styles.roleText}>{profile?.role || 'user'}</Text>
          </View>
        </View>
      </Card>

      {message ? <MessageBanner tone={tone}>{message}</MessageBanner> : null}

      <Card style={styles.formCard}>
        <FormField
          label="Name"
          value={displayName}
          onChangeText={() => {}}
          editable={false}
          icon={<Ionicons name="person-outline" size={18} color={palette.ink500} />}
        />
        <FormField
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          icon={<Ionicons name="mail-outline" size={18} color={palette.ink500} />}
        />
        <FormField
          label="New password"
          value={password}
          onChangeText={setPassword}
          placeholder="Leave blank to keep current password"
          secureTextEntry
          autoCapitalize="none"
          icon={<Ionicons name="lock-closed-outline" size={18} color={palette.ink500} />}
        />
        <FormField
          label="Confirm new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Re-enter new password"
          secureTextEntry
          autoCapitalize="none"
          icon={<Ionicons name="checkmark-circle-outline" size={18} color={palette.ink500} />}
        />

        <PrimaryButton
          label="Save account changes"
          onPress={handleSave}
          loading={loading}
          disabled={!canSave}
          icon={<Ionicons name="save-outline" size={18} color={palette.onAccent} />}
        />
      </Card>
    </ScreenShell>
  );
}

function createStyles(palette, isDark, responsiveMetrics) {
  return StyleSheet.create(scaleStyleDefinitions({
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    cardIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#16304A' : '#EAF2FB',
      borderWidth: 1,
      borderColor: isDark ? '#31506E' : '#C9DDF3',
    },
    cardCopy: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
      minHeight: 38,
    },
    cardTitle: {
      color: palette.ink900,
      fontSize: 19,
      fontWeight: '800',
    },
    rolePill: {
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: isDark ? '#1D8C91' : '#8ADCD6',
      backgroundColor: isDark ? '#0F3A35' : '#E5F8F6',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    roleText: {
      color: palette.ink900,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    cardBody: {
      marginTop: 4,
      color: palette.ink700,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '700',
    },
    formCard: {
      gap: 14,
    },
  }, responsiveMetrics));
}
