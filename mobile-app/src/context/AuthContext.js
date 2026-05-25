import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as ExpoLinking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';
import { supabase, supabaseReady } from '../lib/supabase';
import { isRecoveryUrl, readRecoveryParams } from '../utils/authRecovery';

const AuthContext = createContext(null);
const PROFILE_SELECT = 'id, email, full_name, role, is_active, is_approved, approved_at, approved_by, last_seen_at, operator_tutorial_seen';
const PROFILE_SELECT_FALLBACK = 'id, email, full_name, role, is_active, is_approved, approved_at, approved_by, last_seen_at';

async function ensureProfile(user) {
  if (!supabase || !user) {
    return null;
  }

  let query = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', user.id)
    .maybeSingle();

  if (isMissingColumnError(query.error)) {
    query = await supabase
      .from('profiles')
      .select(PROFILE_SELECT_FALLBACK)
      .eq('id', user.id)
      .maybeSingle();
  }

  if (query.error) {
    throw query.error;
  }

  if (!query.data) {
    const upsert = await supabase.from('profiles').upsert(
      {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Operator',
      },
      { onConflict: 'id' }
    );

    if (upsert.error) {
      throw upsert.error;
    }

    query = await supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .eq('id', user.id)
      .maybeSingle();

    if (isMissingColumnError(query.error)) {
      query = await supabase
        .from('profiles')
        .select(PROFILE_SELECT_FALLBACK)
        .eq('id', user.id)
        .maybeSingle();
    }

    if (query.error) {
      throw query.error;
    }
  }

  const localTutorialSeen = await getLocalOperatorTutorialSeen(user.id);

  return {
    ...query.data,
    operator_tutorial_seen: Boolean(query.data?.operator_tutorial_seen || localTutorialSeen),
  };
}

function getOperatorTutorialKey(userId) {
  return `operator_tutorial_seen:${userId}`;
}

async function getLocalOperatorTutorialSeen(userId) {
  if (!userId) {
    return false;
  }

  try {
    return (await SecureStore.getItemAsync(getOperatorTutorialKey(userId))) === 'true';
  } catch {
    return false;
  }
}

async function setLocalOperatorTutorialSeen(userId) {
  if (!userId) {
    return;
  }

  await SecureStore.setItemAsync(getOperatorTutorialKey(userId), 'true');
}

function getClientInfo() {
  const userAgent =
    Platform.OS === 'web' && typeof navigator !== 'undefined'
      ? navigator.userAgent
      : `${Platform.OS} ${Platform.Version || ''}`.trim();
  const browser =
    Platform.OS === 'web'
      ? userAgent.includes('Edg/')
        ? 'Microsoft Edge'
        : userAgent.includes('Chrome/')
          ? 'Chrome'
          : userAgent.includes('Safari/') && !userAgent.includes('Chrome/')
            ? 'Safari'
            : userAgent.includes('Firefox/')
              ? 'Firefox'
              : 'Web browser'
      : Platform.OS === 'ios'
        ? 'NemeXus iOS app'
        : Platform.OS === 'android'
          ? 'NemeXus Android app'
          : 'NemeXus mobile app';
  const device =
    Platform.OS === 'web'
      ? /Mobi|Android|iPhone|iPad/i.test(userAgent)
        ? 'Mobile web'
        : 'Desktop web'
      : Platform.OS === 'ios'
        ? 'iOS device'
        : Platform.OS === 'android'
          ? 'Android device'
          : Platform.OS;

  return { browser, device, userAgent };
}

function isMissingFunctionError(error) {
  return (
    error?.code === '42883' ||
    error?.code === 'PGRST202' ||
    /function .* does not exist/i.test(error?.message || '') ||
    /could not find .* function/i.test(error?.message || '')
  );
}

async function updateLastSeen(userId) {
  if (!supabase || !userId) {
    return;
  }

  const clientInfo = getClientInfo();
  const rpcResult = await supabase.rpc('update_account_presence', {
    presence_user_agent: clientInfo.userAgent || null,
  });

  if (!rpcResult.error) {
    return;
  }

  const { error } = await supabase
    .from('profiles')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    throw error;
  }
}

function isMissingColumnError(error) {
  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    /column .* does not exist/i.test(error?.message || '') ||
    /could not find .* column/i.test(error?.message || '')
  );
}

function isInvalidRefreshTokenError(error) {
  const message = error?.message || '';

  return (
    error?.name === 'AuthApiError' &&
    /refresh token/i.test(message)
  ) || /invalid refresh token|refresh token.*not found|already used/i.test(message);
}

function getPasswordResetRedirectUrl() {
  return ExpoLinking.createURL('reset-password');
}

async function clearStoredAuthSession() {
  if (!supabase) {
    return;
  }

  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    try {
      await supabase.auth.signOut();
    } catch {
      // The stored token is already unusable; local state will still be cleared.
    }
  }
}

async function insertLoginLogWithFallback(loginLog) {
  const attempts = [
    loginLog,
    {
      user_id: loginLog.user_id,
      email: loginLog.email,
      role: loginLog.role,
      browser: loginLog.browser,
      device: loginLog.device,
      user_agent: loginLog.user_agent,
    },
    {
      user_id: loginLog.user_id,
      email: loginLog.email,
      role: loginLog.role,
    },
    (({ user_id: _userId, profile_id: _profileId, ...rest }) => rest)(loginLog),
  ];
  let lastError = null;

  for (const payload of attempts) {
    const { error } = await supabase.from('account_login_logs').insert(payload);

    if (!error) {
      return;
    }

    lastError = error;

    if (!isMissingColumnError(error)) {
      throw error;
    }
  }

  throw lastError;
}

async function recordSuccessfulLogin(user, profile) {
  if (!supabase || !user) {
    return;
  }

  const clientInfo = getClientInfo();
  const rpcResult = await supabase.rpc('record_account_login', {
    login_user_agent: clientInfo.userAgent || null,
  });

  if (!rpcResult.error) {
    return;
  }

  if (!isMissingFunctionError(rpcResult.error)) {
    throw rpcResult.error;
  }

  const loginLog = {
    user_id: user.id,
    profile_id: user.id,
    email: profile?.email || user.email,
    full_name: profile?.full_name || user.user_metadata?.full_name || null,
    role: profile?.role || 'operator',
    browser: clientInfo.browser,
    device: clientInfo.device,
    user_agent: clientInfo.userAgent,
    logged_in_at: new Date().toISOString(),
  };
  await insertLoginLogWithFallback(loginLog);
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMessage, setAuthMessage] = useState('');
  const [pendingApprovalMessage, setPendingApprovalMessage] = useState('');
  const [passwordRecovery, setPasswordRecovery] = useState({
    active: false,
    message: '',
    tone: 'info',
  });

  function clearAuthState(nextMessage = '') {
    setSession(null);
    setProfile(null);
    setLoading(false);
    setAuthMessage(nextMessage);
    setPendingApprovalMessage('');
    setPasswordRecovery({ active: false, message: '', tone: 'info' });
  }

  const recoverSessionFromUrl = useCallback(async (url) => {
    if (!supabase) {
      return { ok: false, isRecovery: false, message: 'Supabase is not configured yet.' };
    }

    const recovery = readRecoveryParams(url);
    const isRecovery = isRecoveryUrl(url);

    if (!isRecovery) {
      return { ok: false, isRecovery: false, message: '' };
    }

    setPasswordRecovery({ active: true, message: '', tone: 'info' });

    if (recovery.errorDescription) {
      const message = decodeURIComponent(recovery.errorDescription).replace(/\+/g, ' ');
      setPasswordRecovery({ active: true, message, tone: 'error' });
      return {
        ok: false,
        isRecovery: true,
        message,
      };
    }

    if (recovery.code) {
      const { error } = await supabase.auth.exchangeCodeForSession(recovery.code);

      if (error) {
        const message = error.message || 'Invalid reset link.';
        setPasswordRecovery({ active: true, message, tone: 'error' });
        return { ok: false, isRecovery: true, message };
      }

      return { ok: true, isRecovery: true, message: '' };
    }

    if (recovery.tokenHash) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: recovery.tokenHash,
        type: 'recovery',
      });

      if (error) {
        const message = error.message || 'Invalid reset link.';
        setPasswordRecovery({ active: true, message, tone: 'error' });
        return { ok: false, isRecovery: true, message };
      }

      return { ok: true, isRecovery: true, message: '' };
    }

    if (!recovery.accessToken || !recovery.refreshToken) {
      const message = 'This password reset link is incomplete or invalid.';
      setPasswordRecovery({ active: true, message, tone: 'error' });
      return {
        ok: false,
        isRecovery: true,
        message,
      };
    }

    const { error } = await supabase.auth.setSession({
      access_token: recovery.accessToken,
      refresh_token: recovery.refreshToken,
    });

    if (error) {
      const message = error.message || 'Invalid reset link.';
      setPasswordRecovery({ active: true, message, tone: 'error' });
      return { ok: false, isRecovery: true, message };
    }

    return { ok: true, isRecovery: true, message: '' };
  }, []);

  useEffect(() => {
    if (!supabaseReady || !supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    async function bootstrap() {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) {
        return;
      }

      if (error) {
        if (isInvalidRefreshTokenError(error)) {
          await clearStoredAuthSession();
          setSession(null);
          setProfile(null);
          setAuthMessage('Your previous sign-in expired. Please sign in again.');
          setLoading(false);
          return;
        }

        setAuthMessage(error.message);
        setLoading(false);
        return;
      }

      setSession(data.session ?? null);

      if (data.session?.user) {
        try {
          const nextProfile = await ensureProfile(data.session.user);
          if (mounted) {
            setProfile(nextProfile);
            setAuthMessage('');
          }
        } catch (profileError) {
          if (mounted) {
            setAuthMessage(profileError.message || 'Failed to load profile.');
            setProfile(null);
          }
        }
      } else {
        setProfile(null);
      }

      setLoading(false);
    }

    bootstrap();

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) {
        return;
      }

      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery({ active: true, message: '', tone: 'info' });
      }

      setSession(nextSession ?? null);

      if (!nextSession?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      setTimeout(() => {
        async function loadProfileAfterAuthChange() {
          try {
            const nextProfile = await ensureProfile(nextSession.user);
            if (mounted) {
              setProfile(nextProfile);
              setAuthMessage('');
            }
          } catch (profileError) {
            if (mounted) {
              setAuthMessage(profileError.message || 'Failed to load profile.');
              setProfile(null);
            }
          } finally {
            if (mounted) {
              setLoading(false);
            }
          }
        }

        loadProfileAfterAuthChange();
      }, 0);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user?.id) {
      return undefined;
    }

    const touch = () => {
      updateLastSeen(session.user.id).catch((error) => {
        console.warn('Unable to update account presence.', error);
      });
    };

    touch();
    const intervalId = setInterval(touch, 60000);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        touch();
      }
    });

    return () => {
      clearInterval(intervalId);
      subscription.remove();
    };
  }, [session?.user?.id]);

  const value = useMemo(
    () => ({
      session,
      profile,
      user: session?.user ?? null,
      loading,
      authMessage,
      setAuthMessage,
      pendingApprovalMessage,
      passwordRecovery,
      clearPasswordRecovery() {
        setPasswordRecovery({ active: false, message: '', tone: 'info' });
      },
      clearPendingApprovalMessage() {
        setPendingApprovalMessage('');
      },
      async signIn({ email, password }) {
        if (!supabase) {
          return { ok: false, message: 'Supabase is not configured yet.' };
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          return { ok: false, message: error.message };
        }

        try {
          const nextProfile = await ensureProfile(data.user);
          await updateLastSeen(data.user?.id);
          await recordSuccessfulLogin(data.user, nextProfile);
        } catch (logError) {
          console.warn('Unable to record login monitoring data.', logError);
        }

        setPendingApprovalMessage('');
        return { ok: true, message: 'Signed in successfully.' };
      },
      async signUp({ email, password, fullName }) {
        if (!supabase) {
          return { ok: false, message: 'Supabase is not configured yet.' };
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) {
          return { ok: false, message: error.message };
        }

        setPendingApprovalMessage('Registered successfully. Your account is waiting for office approval.');

        if (!data.session) {
          return {
            ok: true,
            message: 'Account created. Ask the office to approve your account in the dashboard before signing in.',
          };
        }

        return {
          ok: true,
          message: 'Account created successfully. Office approval is still required before app access.',
        };
      },
      async requestPasswordReset({ email }) {
        if (!supabase) {
          return { ok: false, message: 'Supabase is not configured yet.' };
        }

        const normalizedEmail = email?.trim()?.toLowerCase();

        if (!normalizedEmail) {
          return { ok: false, message: 'Enter your email before requesting a password reset.' };
        }

        const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: getPasswordResetRedirectUrl(),
        });

        if (error) {
          return {
            ok: false,
            message: error.message || 'Unable to send password reset email.',
          };
        }

        return {
          ok: true,
          message: 'Password reset email sent. Open the link to choose a new password.',
        };
      },
      recoverSessionFromUrl,
      async updatePassword({ password }) {
        if (!supabase) {
          return { ok: false, message: 'Supabase is not configured yet.' };
        }

        const { error } = await supabase.auth.updateUser({ password });

        if (error) {
          return { ok: false, message: error.message };
        }

        setPasswordRecovery({ active: false, message: '', tone: 'info' });
        return { ok: true, message: 'Password updated successfully.' };
      },
      async updateAccountCredentials({ email, password }) {
        if (!supabase) {
          return { ok: false, message: 'Supabase is not configured yet.' };
        }

        const updates = {};
        const nextEmail = email?.trim();

        if (nextEmail && nextEmail !== profile?.email) {
          updates.email = nextEmail;
        }

        if (password?.trim()) {
          updates.password = password;
        }

        if (!updates.email && !updates.password) {
          return { ok: false, message: 'Change your email or enter a new password before saving.' };
        }

        const { error } = await supabase.auth.updateUser(updates);

        if (error) {
          return { ok: false, message: error.message };
        }

        if (updates.email && profile?.id) {
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ email: updates.email })
            .eq('id', profile.id);

          if (profileError) {
            return { ok: false, message: profileError.message || 'Account updated, but the profile email could not be refreshed.' };
          }

          setProfile((current) => (current ? { ...current, email: updates.email } : current));
        }

        return {
          ok: true,
          message: updates.email && updates.password
            ? 'Email and password updated successfully.'
            : updates.email
              ? 'Email updated successfully.'
              : 'Password updated successfully.',
        };
      },
      async completeOperatorTutorial() {
        const userId = session?.user?.id || profile?.id;

        try {
          await setLocalOperatorTutorialSeen(userId);
        } catch (storageError) {
          console.warn('Unable to save local tutorial status.', storageError);
        }

        if (supabase && userId) {
          const { error } = await supabase
            .from('profiles')
            .update({ operator_tutorial_seen: true })
            .eq('id', userId);

          if (error && !isMissingColumnError(error)) {
            console.warn('Unable to save operator tutorial status.', error);
          }
        }

        setProfile((current) => (
          current
            ? { ...current, operator_tutorial_seen: true }
            : current
        ));

        return { ok: true };
      },
      async signOut() {
        if (!supabase) {
          clearAuthState('');
          return { ok: true, message: 'Signed out.' };
        }

        const { error } = await supabase.auth.signOut();

        if (error) {
          if (isInvalidRefreshTokenError(error)) {
            clearAuthState('');
            return { ok: true, message: 'Signed out.' };
          }

          return { ok: false, message: error.message || 'Failed to sign out.' };
        }

        clearAuthState('Signed out successfully.');
        return { ok: true, message: 'Signed out successfully.' };
      },
      async refreshProfile() {
        if (!session?.user) {
          return;
        }

        try {
          const nextProfile = await ensureProfile(session.user);
          setProfile(nextProfile);
          setAuthMessage('');
        } catch (profileError) {
          setAuthMessage(profileError.message || 'Failed to refresh profile.');
        }
      },
    }),
    [authMessage, loading, passwordRecovery, pendingApprovalMessage, profile, recoverSessionFromUrl, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return value;
}
