import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Card from '../components/Card';
import MessageBanner from '../components/MessageBanner';
import PrimaryButton from '../components/PrimaryButton';
import ScreenShell from '../components/ScreenShell';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getResponsiveMetrics, scaleStyleDefinitions } from '../theme';
import { getOfflineReadingCount, syncOfflineReadings } from '../services/offlineReadings';
import { getReadingForSlot, listReadings } from '../services/readings';
import { listAccessibleSites } from '../services/sites';
import {
  evaluateSiteGeofence,
  findNearestSiteGeofence,
  formatDistanceMeters,
  getSiteCoordinates,
  requestCurrentLocation,
} from '../utils/geofence';
import { shiftNameForSlot } from '../utils/shiftSchedule';
import { formatTimestamp, roundDownTo30MinSlot } from '../utils/time';

function getSiteDescription(type) {
  return type === 'CHLORINATION'
    ? 'Residual chlorine, tank level, flowrate, and treatment checks.'
    : 'Pressure, flow, power, and electrical monitoring for the pump station.';
}

function formatDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readingOperatorName(reading) {
  return reading?.submitted_profile?.full_name || reading?.submitted_profile?.email || 'another operator';
}

const liveTutorialSteps = [
  {
    target: 'options',
    icon: 'business-outline',
    title: 'Start with your assigned site',
    body: 'These cards are the real site choices for your shift. Tap the card for the facility you are working on.',
  },
  {
    target: 'gps',
    icon: 'navigate-outline',
    title: 'Check GPS authorization',
    body: 'The GPS panel confirms whether you are inside the allowed site zone before submitting readings.',
  },
  {
    target: 'submit',
    icon: 'create-outline',
    title: 'Submit the checkpoint',
    body: 'After selecting a valid site, use this button to enter and save the current checkpoint reading.',
  },
  {
    target: 'status',
    icon: 'pulse-outline',
    title: 'Track shift status',
    body: 'This status card shows the active shift, today’s progress, and whether readings are syncing online.',
  },
];

function SkeletonBlock({ styles, style }) {
  return <View style={[styles.skeletonBlock, style]} />;
}

function StatusStripSkeleton({ styles }) {
  return (
    <Card style={styles.statusStripCard}>
      {[0, 1, 2].map((item) => (
        <View key={item} style={styles.statusStripItem}>
          <SkeletonBlock styles={styles} style={styles.skeletonTinyLine} />
          <SkeletonBlock styles={styles} style={styles.skeletonValueLine} />
        </View>
      ))}
    </Card>
  );
}

function SiteOptionsSkeleton({ styles }) {
  return (
    <View style={styles.options}>
      {[0, 1].map((item) => (
        <Card key={item} style={[styles.option, styles.skeletonCard]}>
          <View style={styles.optionTopRow}>
            <SkeletonBlock styles={styles} style={styles.skeletonSquareIcon} />
            <View style={styles.optionCopy}>
              <SkeletonBlock styles={styles} style={styles.skeletonOptionTitle} />
              <SkeletonBlock styles={styles} style={styles.skeletonOptionBody} />
              <SkeletonBlock styles={styles} style={styles.skeletonOptionBodyShort} />
            </View>
            <SkeletonBlock styles={styles} style={styles.skeletonBadgeWide} />
          </View>
          <View style={styles.optionMetaRow}>
            <SkeletonBlock styles={styles} style={styles.skeletonPill} />
            <SkeletonBlock styles={styles} style={styles.skeletonPillShort} />
          </View>
        </Card>
      ))}
    </View>
  );
}

export default function SiteSelectionScreen({ navigation, onSelectedSiteChange, liveTutorial = false, tutorialRunId = 0 }) {
  const { profile, completeOperatorTutorial } = useAuth();
  const { palette, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const responsiveMetrics = useMemo(() => getResponsiveMetrics(width), [width]);
  const styles = useMemo(() => createStyles(palette, isDark, responsiveMetrics), [palette, isDark, responsiveMetrics]);
  const tutorialScrollRef = useRef(null);
  const tutorialTargetLayouts = useRef({});
  const isPrivileged = ['admin', 'supervisor', 'manager', 'general_manager'].includes(profile?.role);
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncingOffline, setSyncingOffline] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);
  const [message, setMessage] = useState('');
  const [offlineMessage, setOfflineMessage] = useState('');
  const [offlineTone, setOfflineTone] = useState('info');
  const [operatorLocation, setOperatorLocation] = useState(null);
  const [locationChecking, setLocationChecking] = useState(false);
  const [geofenceMessage, setGeofenceMessage] = useState('');
  const [geofenceTone, setGeofenceTone] = useState('info');
  const [currentSlot, setCurrentSlot] = useState(() => roundDownTo30MinSlot(new Date()));
  const [currentSlotReading, setCurrentSlotReading] = useState(null);
  const [checkpointSummary, setCheckpointSummary] = useState({
    completed: 0,
    missing: 0,
    expected: 0,
  });
  const [checkpointLoading, setCheckpointLoading] = useState(false);
  const [liveTutorialVisible, setLiveTutorialVisible] = useState(Boolean(liveTutorial));
  const [liveTutorialStep, setLiveTutorialStep] = useState(0);
  const [connectionOnline, setConnectionOnline] = useState(() => {
    if (typeof navigator === 'undefined') {
      return true;
    }

    return navigator.onLine !== false;
  });
  const geofenceBySiteId = useMemo(() => {
    return Object.fromEntries(
      sites.map((site) => [String(site.id), evaluateSiteGeofence(site, operatorLocation)])
    );
  }, [operatorLocation, sites]);
  const selectedGeofence = selectedSite ? geofenceBySiteId[String(selectedSite.id)] : null;
  const selectedSiteHasGeofence = Boolean(getSiteCoordinates(selectedSite));
  const selectedSiteBlocked = Boolean(selectedSiteHasGeofence && selectedGeofence && !selectedGeofence.allowed);
  const selectedZoneState = locationChecking
    ? 'checking'
    : !selectedSiteHasGeofence
      ? 'inactive'
      : !operatorLocation
        ? 'needed'
        : selectedGeofence?.allowed
          ? 'inside'
          : selectedGeofence?.accuracyAcceptable === false
            ? 'accuracy'
            : 'outside';
  const selectedZoneLabel = {
    inside: 'Inside zone',
    outside: 'Outside zone',
    accuracy: 'Low GPS accuracy',
    checking: 'Checking GPS',
    needed: 'GPS needed',
    inactive: 'No GPS fence',
  }[selectedZoneState];
  const activeTutorialTarget = liveTutorialVisible ? liveTutorialSteps[liveTutorialStep]?.target : null;

  function registerTutorialTarget(target) {
    return (event) => {
      tutorialTargetLayouts.current[target] = event.nativeEvent.layout.y;
    };
  }

  useEffect(() => {
    if (!liveTutorial) {
      return;
    }

    setLiveTutorialStep(0);
    setLiveTutorialVisible(true);
  }, [liveTutorial, tutorialRunId]);

  useEffect(() => {
    if (!liveTutorialVisible || !activeTutorialTarget) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      const y = tutorialTargetLayouts.current[activeTutorialTarget];
      if (typeof y === 'number') {
        tutorialScrollRef.current?.scrollTo?.({
          y: Math.max(y - 18, 0),
          animated: true,
        });
      }
    }, 120);

    return () => clearTimeout(timeoutId);
  }, [activeTutorialTarget, liveTutorialVisible]);

  async function finishLiveTutorial() {
    setLiveTutorialVisible(false);
    setLiveTutorialStep(0);
    await completeOperatorTutorial?.();
    navigation.navigate('site-selection');
  }

  function advanceLiveTutorial() {
    if (liveTutorialStep >= liveTutorialSteps.length - 1) {
      finishLiveTutorial();
      return;
    }

    setLiveTutorialStep((current) => current + 1);
  }
  const selectedZoneIcon = {
    inside: 'checkmark-circle',
    outside: 'close-circle',
    accuracy: 'warning',
    checking: 'time-outline',
    needed: 'locate-outline',
    inactive: 'remove-circle-outline',
  }[selectedZoneState];

  useEffect(() => {
    let mounted = true;

    async function loadSites() {
      setLoading(true);

      try {
        const nextSites = await listAccessibleSites();
        if (!mounted) {
          return;
        }

        setSites(nextSites);
        setSelectedSite(nextSites[0] || null);
        const nextOfflineCount = await getOfflineReadingCount();
        if (mounted) {
          setOfflineCount(nextOfflineCount);
        }

        if (!nextSites.length) {
          setMessage('No sites were found. Re-run the schema seed if the sites table is empty.');
        }
      } catch (error) {
        if (mounted) {
          setMessage(error.message || 'Failed to load sites.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadSites();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    onSelectedSiteChange?.(selectedSite);
  }, [onSelectedSiteChange, selectedSite]);

  useEffect(() => {
    let mounted = true;

    async function locateOperator() {
      if (!sites.length) {
        return;
      }

      if (!sites.some((site) => getSiteCoordinates(site))) {
        setGeofenceTone('info');
        setGeofenceMessage('Site coordinates are not configured yet. GPS guard is inactive for these sites.');
        return;
      }

      setLocationChecking(true);
      try {
        const location = await requestCurrentLocation();
        if (!mounted) {
          return;
        }

        setOperatorLocation(location);
        const nearest = findNearestSiteGeofence(sites, location);
        if (nearest?.result.allowed) {
          setSelectedSite(nearest.site);
          setGeofenceTone('success');
          setGeofenceMessage(
            `GPS verified near ${nearest.site.name} (${formatDistanceMeters(nearest.result.distanceM)} away).`
          );
        } else if (nearest) {
          setGeofenceTone('error');
          setGeofenceMessage(
            `You are outside the authorized zone. Nearest site is ${nearest.site.name} (${formatDistanceMeters(
              nearest.result.distanceM
            )} away; allowed radius ${formatDistanceMeters(nearest.result.radiusM)}).`
          );
        } else {
          setGeofenceTone('info');
          setGeofenceMessage('Site coordinates are not configured yet. GPS guard is inactive for these sites.');
        }
      } catch (error) {
        if (mounted) {
          setOperatorLocation(null);
          setGeofenceTone('error');
          setGeofenceMessage(error.message || 'Unable to verify GPS location.');
        }
      } finally {
        if (mounted) {
          setLocationChecking(false);
        }
      }
    }

    locateOperator();

    return () => {
      mounted = false;
    };
  }, [sites]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentSlot(roundDownTo30MinSlot(new Date()));
    }, 30000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.addEventListener !== 'function' ||
      typeof window.removeEventListener !== 'function'
    ) {
      return undefined;
    }

    function handleOnline() {
      setConnectionOnline(true);
    }

    function handleOffline() {
      setConnectionOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadCheckpointPreview() {
      if (!selectedSite?.id || !selectedSite?.type) {
        setCurrentSlotReading(null);
        setCheckpointSummary({ completed: 0, missing: 0, expected: 0 });
        return;
      }

      setCheckpointLoading(true);

      try {
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const expectedThroughCurrent = Math.floor((currentSlot.getTime() - todayStart.getTime()) / (30 * 60 * 1000)) + 1;
        const expectedBeforeCurrent = Math.max(expectedThroughCurrent - 1, 0);
        const [duplicate, todayReadings] = await Promise.all([
          getReadingForSlot({
            siteId: selectedSite.id,
            siteType: selectedSite.type,
            slotIso: currentSlot.toISOString(),
          }),
          listReadings({
            siteId: selectedSite.id,
            siteType: selectedSite.type,
            fromDate: formatDateValue(todayStart),
            toDate: formatDateValue(todayStart),
            limit: 200,
          }),
        ]);

        if (!mounted) {
          return;
        }

        const savedSlots = new Set(
          todayReadings
            .map((reading) => reading.slot_datetime)
            .filter(Boolean)
            .map((value) => new Date(value).getTime())
        );
        const completedBeforeCurrent = [...savedSlots].filter((time) => time < currentSlot.getTime()).length;
        const completed = [...savedSlots].filter((time) => time <= currentSlot.getTime()).length;

        setCurrentSlotReading(duplicate);
        setCheckpointSummary({
          completed,
          missing: Math.max(expectedBeforeCurrent - completedBeforeCurrent, 0),
          expected: expectedThroughCurrent,
        });
      } catch {
        if (mounted) {
          setCurrentSlotReading(null);
          setCheckpointSummary({ completed: 0, missing: 0, expected: 0 });
        }
      } finally {
        if (mounted) {
          setCheckpointLoading(false);
        }
      }
    }

    loadCheckpointPreview();

    return () => {
      mounted = false;
    };
  }, [currentSlot, selectedSite?.id, selectedSite?.type]);

  async function refreshOfflineCount() {
    const nextCount = await getOfflineReadingCount();
    setOfflineCount(nextCount);
  }

  async function handleSyncOfflineReadings() {
    if (syncingOffline) {
      return;
    }

    setSyncingOffline(true);
    setOfflineTone('info');
    setOfflineMessage('Syncing offline readings...');

    try {
      const result = await syncOfflineReadings();
      await refreshOfflineCount();

      if (result.remaining) {
        setOfflineTone('error');
        setOfflineMessage(
          `${result.synced} offline reading(s) synced. ${result.remaining} still pending. ${
            result.lastError || 'Check the connection and try again.'
          }`
        );
        return;
      }

      const skippedText = result.skipped ? ` ${result.skipped} duplicate slot(s) were already saved.` : '';
      setOfflineTone('success');
      setOfflineMessage(`${result.synced} offline reading(s) synced successfully.${skippedText}`);
    } catch (error) {
      setOfflineTone('error');
      setOfflineMessage(error.message || 'Failed to sync offline readings.');
      await refreshOfflineCount();
    } finally {
      setSyncingOffline(false);
    }
  }

  async function refreshOperatorLocation() {
    if (!sites.some((site) => getSiteCoordinates(site))) {
      setOperatorLocation(null);
      setGeofenceTone('info');
      setGeofenceMessage('Site coordinates are not configured yet. GPS guard is inactive for these sites.');
      return null;
    }

    setLocationChecking(true);
    try {
      const location = await requestCurrentLocation();
      setOperatorLocation(location);
      const nearest = findNearestSiteGeofence(sites, location);
      if (nearest?.result.allowed) {
        setSelectedSite(nearest.site);
        setGeofenceTone('success');
        setGeofenceMessage(
          `GPS verified near ${nearest.site.name} (${formatDistanceMeters(nearest.result.distanceM)} away).`
        );
      } else if (nearest) {
        setGeofenceTone('error');
        setGeofenceMessage(
          `You are outside the authorized zone. Nearest site is ${nearest.site.name} (${formatDistanceMeters(
            nearest.result.distanceM
          )} away; allowed radius ${formatDistanceMeters(nearest.result.radiusM)}).`
        );
      } else {
        setGeofenceTone('info');
        setGeofenceMessage('Site coordinates are not configured yet. GPS guard is inactive for these sites.');
      }
      return location;
    } catch (error) {
      setOperatorLocation(null);
      setGeofenceTone('error');
      setGeofenceMessage(error.message || 'Unable to verify GPS location.');
      return null;
    } finally {
      setLocationChecking(false);
    }
  }

  async function handleNavigateToSubmit(site) {
    if (!site) {
      return;
    }

    const siteHasGeofence = Boolean(getSiteCoordinates(site));
    let location = operatorLocation;

    if (siteHasGeofence && !location) {
      location = await refreshOperatorLocation();
    }

    const result = evaluateSiteGeofence(site, location);

    if (siteHasGeofence && !result.allowed) {
      const accuracyNote = result.accuracyAcceptable
        ? ''
        : ` GPS accuracy is ${formatDistanceMeters(result.accuracyM)}; retry when it is within ${formatDistanceMeters(
            result.requiredAccuracyM
          )}.`;
      setSelectedSite(site);
      setGeofenceTone('error');
      setGeofenceMessage(
        `You are outside the authorized zone for ${site.name}. Move within ${formatDistanceMeters(
          result.radiusM
        )} and retry.${accuracyNote}`
      );
      return;
    }

    setSelectedSite(site);
    navigation.navigate('submit-reading', { site });
  }

  const showSiteSkeleton = loading && !sites.length;
  const showStatusSkeleton = showSiteSkeleton || (checkpointLoading && !selectedSite);

  return (
    <ScreenShell
      eyebrow="Operator workspace"
      title="Select site"
      subtitle={`Signed in as ${profile?.full_name || profile?.email || 'User'} (${profile?.role || 'operator'})`}
      showMenuButton
      onAccountEditPress={navigation.openAccountEdit}
      onTutorialPress={navigation.openTutorial}
      scrollRef={tutorialScrollRef}
      floatingOverlay={
        liveTutorialVisible ? (
          <View
            style={[
              styles.liveTutorialOverlay,
              activeTutorialTarget === 'submit' && styles.liveTutorialOverlayTop,
            ]}
            pointerEvents="box-none"
          >
            <View style={styles.liveTutorialBackdrop} pointerEvents="none" />
            <Card style={styles.liveTutorialCard}>
              <View style={styles.liveTutorialTopRow}>
                <View style={styles.liveTutorialIcon}>
                  <Ionicons name={liveTutorialSteps[liveTutorialStep].icon} size={19} color={palette.cyan300} />
                </View>
                <View style={styles.liveTutorialCopy}>
                  <Text style={styles.liveTutorialEyebrow}>
                    Step {liveTutorialStep + 1} of {liveTutorialSteps.length}
                  </Text>
                  <Text style={styles.liveTutorialTitle}>{liveTutorialSteps[liveTutorialStep].title}</Text>
                </View>
              </View>
              <Text style={styles.liveTutorialBody}>{liveTutorialSteps[liveTutorialStep].body}</Text>
              <View style={styles.liveTutorialDots}>
                {liveTutorialSteps.map((step, index) => (
                  <View
                    key={step.title}
                    style={[styles.liveTutorialDot, index === liveTutorialStep && styles.liveTutorialDotActive]}
                  />
                ))}
              </View>
              <View style={styles.liveTutorialActions}>
                <Pressable onPress={finishLiveTutorial} style={({ pressed }) => [styles.liveTutorialSkip, pressed && styles.liveTutorialPressed]}>
                  <Text style={styles.liveTutorialSkipText}>Skip</Text>
                </Pressable>
                <Pressable onPress={advanceLiveTutorial} style={({ pressed }) => [styles.liveTutorialNext, pressed && styles.liveTutorialPressed]}>
                  <Text style={styles.liveTutorialNextText}>
                    {liveTutorialStep === liveTutorialSteps.length - 1 ? 'Finish' : 'Next'}
                  </Text>
                  <Ionicons
                    name={liveTutorialStep === liveTutorialSteps.length - 1 ? 'checkmark-outline' : 'arrow-forward-outline'}
                    size={15}
                    color={palette.onAccent}
                  />
                </Pressable>
              </View>
            </Card>
          </View>
        ) : null
      }
    >
      {selectedSite && checkpointSummary.missing > 0 ? (
        <MessageBanner tone="error">
          {checkpointSummary.missing} earlier checkpoint{checkpointSummary.missing === 1 ? '' : 's'} appear missing today for {selectedSite.name}.
        </MessageBanner>
      ) : selectedSite ? (
        <MessageBanner tone="success">No missed checkpoints detected today for {selectedSite.name}.</MessageBanner>
      ) : null}

      {showStatusSkeleton ? (
        <StatusStripSkeleton styles={styles} />
      ) : selectedSite ? (
        <View
          onLayout={registerTutorialTarget('status')}
          style={[styles.tutorialTarget, activeTutorialTarget === 'status' && styles.tutorialTargetActive]}
        >
        <Card style={styles.statusStripCard}>
          <View style={styles.statusStripItem}>
            <Text style={styles.statusStripLabel}>Shift</Text>
            <Text style={styles.statusStripValue}>{shiftNameForSlot(currentSlot)}</Text>
          </View>
          <View style={styles.statusStripItem}>
            <Text style={styles.statusStripLabel}>Today</Text>
            <Text style={styles.statusStripValue}>
              {checkpointSummary.completed}/{checkpointSummary.expected}
            </Text>
          </View>
          <View style={styles.statusStripItem}>
            <Text style={styles.statusStripLabel}>Sync</Text>
            <Text style={styles.statusStripValue}>
              {connectionOnline ? 'Online' : 'Offline'}{offlineCount ? ` · ${offlineCount} pending` : ''}
            </Text>
          </View>
        </Card>
        </View>
      ) : null}
      
      <Card style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <View style={styles.summaryIcon}>
            <Ionicons name="compass-outline" size={18} color={palette.ink900} />
          </View>
          <View style={styles.summaryCopy}>
            <Text style={styles.sectionTitle}>Choose the site for this shift</Text>
            <Text style={styles.sectionBody}>
              Confirm where you are assigned today, then continue to submit a new reading or review recent history.
            </Text>
          </View>
        </View>
      </Card>
      {selectedSite ? (
        <Card style={styles.selectionCard}>
          <View style={styles.selectionHeader}>
            <View style={styles.selectionIcon}>
              <Ionicons
                name={selectedSite.type === 'CHLORINATION' ? 'water-outline' : 'flash-outline'}
                size={16}
                color={palette.ink900}
              />
            </View>
            <View style={styles.selectionCopy}>
              <Text style={styles.selectionTitle}>Ready for {selectedSite.name}</Text>
              <Text style={styles.selectionBody}>
                {selectedSite.type === 'CHLORINATION' ? 'Chlorination line' : 'Deepwell station'}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}
      
      {false && selectedSite ? (
        <Card style={[styles.checkpointCard, currentSlotReading ? styles.checkpointCardComplete : styles.checkpointCardDue]}>
          <View style={styles.checkpointHeader}>
            <View style={styles.checkpointIcon}>
              <Ionicons
                name={currentSlotReading ? 'checkmark-circle-outline' : 'radio-button-on-outline'}
                size={18}
                color={palette.ink900}
              />
            </View>
            <View style={styles.checkpointCopy}>
              <View style={styles.checkpointTitleRow}>
                <Text style={styles.checkpointSiteName} numberOfLines={1}>{selectedSite.name}</Text>
                <View style={[styles.checkpointStatusBadge, currentSlotReading ? styles.checkpointStatusDone : styles.checkpointStatusPending]}>
                  <Text style={styles.checkpointStatusText}>{currentSlotReading ? 'Done' : 'Not submitted'}</Text>
                </View>
              </View>
              <Text style={styles.checkpointTitle}>
                {currentSlotReading ? 'Current checkpoint submitted' : 'Current checkpoint due now'}
              </Text>
              <Text style={styles.checkpointBody}>
                Slot {formatTimestamp(currentSlot)} · {shiftNameForSlot(currentSlot)}
              </Text>
              <Text style={styles.checkpointHint}>
                {checkpointLoading
                  ? 'Checking saved readings...'
                  : currentSlotReading
                    ? `Already saved by ${readingOperatorName(currentSlotReading)}.`
                    : `${selectedSite.name} has no reading saved for this slot yet.`}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      

      

      {message ? <MessageBanner tone={sites.length ? 'info' : 'error'}>{message}</MessageBanner> : null}
      {offlineMessage ? <MessageBanner tone={offlineTone}>{offlineMessage}</MessageBanner> : null}
      {geofenceMessage ? <MessageBanner tone={geofenceTone}>{geofenceMessage}</MessageBanner> : null}

      <View
        onLayout={registerTutorialTarget('gps')}
        style={[styles.tutorialTarget, activeTutorialTarget === 'gps' && styles.tutorialTargetActive]}
      >
      <Card style={styles.geofenceCard}>
        <View style={styles.geofenceHeader}>
          <View style={styles.geofenceIcon}>
            <Ionicons name="navigate-outline" size={18} color={palette.ink900} />
          </View>
          <View style={styles.geofenceCopy}>
            <View style={styles.geofenceTitleRow}>
              <Text style={styles.geofenceTitle}>GPS authorization</Text>
              <View style={[styles.zoneBadge, styles[`zoneBadge_${selectedZoneState}`]]}>
                <Ionicons name={selectedZoneIcon} size={13} color={palette.ink900} />
                <Text style={styles.zoneBadgeText}>{selectedZoneLabel}</Text>
              </View>
            </View>
            <Text style={styles.geofenceBody}>
              {locationChecking
                ? 'Checking current location...'
                : selectedSiteHasGeofence
                  ? `${selectedSite?.name || 'Selected site'}: ${formatDistanceMeters(
                      selectedGeofence?.distanceM
                    )} away, radius ${formatDistanceMeters(selectedGeofence?.radiusM)}.`
                  : 'Coordinates are not configured for this selected site yet.'}
            </Text>
          </View>
        </View>
        <PrimaryButton
          label={locationChecking ? 'Checking GPS...' : 'Retry GPS check'}
          onPress={refreshOperatorLocation}
          loading={locationChecking}
          tone="secondary"
          icon={<Ionicons name="locate-outline" size={16} color={palette.ink900} />}
        />
      </Card>
      </View>

      {offlineCount ? (
        <Card style={styles.offlineCard}>
          <View style={styles.offlineHeader}>
            <View style={styles.offlineIcon}>
              <Ionicons name="cloud-offline-outline" size={18} color={palette.ink900} />
            </View>
            <View style={styles.offlineCopy}>
              <Text style={styles.offlineTitle}>Offline readings pending</Text>
              <Text style={styles.offlineBody}>
                {offlineCount} saved reading{offlineCount === 1 ? '' : 's'} waiting to sync.
              </Text>
            </View>
          </View>
          <PrimaryButton
            label={syncingOffline ? 'Syncing...' : 'Sync now'}
            onPress={handleSyncOfflineReadings}
            loading={syncingOffline}
            tone="secondary"
            icon={<Ionicons name="sync-outline" size={16} color={palette.ink900} />}
          />
        </Card>
      ) : null}

      <View
        onLayout={registerTutorialTarget('options')}
        style={[styles.tutorialTarget, activeTutorialTarget === 'options' && styles.tutorialTargetActive]}
      >
        {loading ? (
          <SiteOptionsSkeleton styles={styles} />
        ) : (
          <View style={styles.options}>
          {sites.map((site) => {
            const active = selectedSite?.id === site.id;
            const siteGeofence = geofenceBySiteId[String(site.id)];
            const siteHasGeofence = Boolean(getSiteCoordinates(site));
            const blocked = Boolean(siteHasGeofence && siteGeofence && !siteGeofence.allowed);
            return (
              <Pressable
                key={site.id}
                onPress={() => setSelectedSite(site)}
                style={[styles.option, blocked && styles.optionBlocked, active && styles.optionActive]}
              >
                <View style={[styles.optionAccent, active && styles.optionAccentActive]} />
                <View style={styles.optionTopRow}>
                  <View style={[styles.typeIcon, active && styles.typeIconActive]}>
                    <Ionicons
                      name={site.type === 'CHLORINATION' ? 'water-outline' : 'flash-outline'}
                      size={17}
                      color={active ? palette.onAccent : palette.ink900}
                    />
                  </View>
                  <View style={styles.optionCopy}>
                    <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>{site.name}</Text>
                    <Text style={[styles.optionSubhead, active && styles.optionSubheadActive]}>
                      {getSiteDescription(site.type)}
                    </Text>
                  </View>
                  <View style={[styles.badge, active && styles.badgeActive]}>
                    <Text style={[styles.badgeLabel, active && styles.badgeLabelActive]}>{site.type}</Text>
                  </View>
                </View>
                <View style={styles.optionMetaRow}>
                  <View style={[styles.optionMetaPill, active && styles.optionMetaPillActive]}>
                    <Ionicons
                      name="location-outline"
                      size={12}
                      color={active ? palette.onAccent : palette.ink700}
                    />
                    <Text style={[styles.optionMetaText, active && styles.optionMetaTextActive]}>
                      {siteHasGeofence
                        ? `${formatDistanceMeters(siteGeofence?.distanceM)} away`
                        : `Site ID ${site.id}`}
                    </Text>
                  </View>
                  <View style={[styles.optionMetaPill, active && styles.optionMetaPillActive]}>
                    <Ionicons
                      name={blocked ? 'lock-closed-outline' : active ? 'checkmark-circle' : 'ellipse-outline'}
                      size={12}
                      color={active ? palette.onAccent : palette.ink700}
                    />
                    <Text style={[styles.optionMetaText, active && styles.optionMetaTextActive]}>
                      {blocked ? 'Outside zone' : active ? 'Selected now' : 'Tap to select'}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
          </View>
        )}
      </View>

      <View
        onLayout={registerTutorialTarget('submit')}
        style={[styles.actions, styles.tutorialTarget, activeTutorialTarget === 'submit' && styles.tutorialTargetActive]}
      >
        <PrimaryButton
          label={currentSlotReading ? 'Current slot already saved' : 'Submit current checkpoint'}
          onPress={() => handleNavigateToSubmit(selectedSite)}
          disabled={!selectedSite || Boolean(currentSlotReading) || selectedSiteBlocked || locationChecking}
          icon={<Ionicons name="create-outline" size={16} color={palette.onAccent} />}
        />
        {isPrivileged ? (
          <PrimaryButton
            label="Back to office dashboard"
            onPress={() => navigation.navigate('office-dashboard')}
            tone="secondary"
            icon={<Ionicons name="grid-outline" size={16} color={palette.ink900} />}
          />
        ) : null}
      </View>
    </ScreenShell>
  );
}

function createStyles(palette, isDark, responsiveMetrics) {
  return StyleSheet.create(scaleStyleDefinitions({
    summaryCard: {
      gap: 12,
    },
    summaryHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    summaryIcon: {
      width: 36,
      height: 36,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#16304A' : '#EAF2FB',
      borderWidth: 1,
      borderColor: isDark ? '#31506E' : '#C9DDF3',
    },
    summaryCopy: {
      flex: 1,
    },
    sectionTitle: {
      color: palette.ink900,
      fontSize: 18,
      fontWeight: '800',
    },
    sectionBody: {
      marginTop: 8,
      color: palette.ink700,
      fontSize: 14,
      lineHeight: 20,
    },
    options: {
      gap: 12,
    },
    actions: {
      gap: 12,
    },
    tutorialTarget: {
      borderWidth: 2,
      borderColor: 'transparent',
      borderRadius: 16,
      padding: 3,
      margin: -3,
    },
    tutorialTargetActive: {
      borderColor: palette.cyan300,
      backgroundColor: isDark ? 'rgba(103,232,249,0.08)' : 'rgba(20,184,166,0.1)',
      shadowColor: palette.teal600,
      shadowOpacity: isDark ? 0.24 : 0.18,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 0 },
      elevation: 12,
    },
    liveTutorialOverlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      justifyContent: 'flex-end',
      padding: responsiveMetrics.contentPadding,
      zIndex: 5000,
      elevation: 5000,
    },
    liveTutorialOverlayTop: {
      justifyContent: 'flex-start',
      paddingTop: responsiveMetrics.contentPadding + 8,
    },
    liveTutorialBackdrop: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: isDark ? 'rgba(0,0,0,0.12)' : 'rgba(17,35,59,0.08)',
    },
    liveTutorialCard: {
      gap: 12,
      backgroundColor: isDark ? '#0B1724' : '#F8FCFF',
      borderColor: isDark ? '#2B5877' : '#B8DDF0',
      shadowColor: '#000000',
      shadowOpacity: isDark ? 0.26 : 0.16,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 5200,
    },
    liveTutorialTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    liveTutorialIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#102A3A' : '#163A5B',
      borderWidth: 1,
      borderColor: isDark ? '#1E5B70' : '#67E8F9',
    },
    liveTutorialCopy: {
      flex: 1,
      gap: 2,
    },
    liveTutorialEyebrow: {
      color: palette.teal600,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    liveTutorialTitle: {
      color: palette.ink900,
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '900',
    },
    liveTutorialBody: {
      color: palette.ink700,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: '700',
    },
    liveTutorialDots: {
      flexDirection: 'row',
      gap: 6,
    },
    liveTutorialDot: {
      width: 7,
      height: 7,
      borderRadius: 999,
      backgroundColor: isDark ? '#294C68' : '#C9DDF3',
    },
    liveTutorialDotActive: {
      width: 20,
      backgroundColor: palette.teal600,
    },
    liveTutorialActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    liveTutorialSkip: {
      minHeight: 42,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
    },
    liveTutorialSkipText: {
      color: palette.ink700,
      fontSize: 12,
      fontWeight: '900',
    },
    liveTutorialNext: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: palette.teal600,
    },
    liveTutorialNextText: {
      color: palette.onAccent,
      fontSize: 12,
      fontWeight: '900',
    },
    liveTutorialPressed: {
      transform: [{ scale: 0.98 }],
    },
    option: {
      backgroundColor: palette.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? palette.line : '#CFE0EE',
      padding: 14,
      overflow: 'hidden',
    },
    optionActive: {
      backgroundColor: isDark ? palette.navy700 : '#163A5B',
      borderColor: isDark ? palette.cyan300 : '#67E8F9',
    },
    optionBlocked: {
      opacity: 0.72,
      borderColor: isDark ? '#70464A' : '#F0B8BE',
      backgroundColor: isDark ? '#24161B' : '#FFF5F6',
    },
    optionAccent: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 4,
      backgroundColor: isDark ? '#31506E' : '#BFD9EC',
    },
    optionAccentActive: {
      backgroundColor: isDark ? palette.cyan300 : palette.teal500,
    },
    optionTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 10,
    },
    typeIcon: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#152636' : '#EAF2FB',
      borderWidth: 1,
      borderColor: isDark ? palette.line : '#C9DDF3',
    },
    typeIconActive: {
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderColor: 'rgba(255,255,255,0.24)',
    },
    optionCopy: {
      flex: 1,
      gap: 4,
    },
    optionTitle: {
      color: palette.ink900,
      fontSize: 17,
      fontWeight: '800',
    },
    optionTitleActive: {
      color: palette.onAccent,
    },
    optionSubhead: {
      color: palette.ink700,
      fontSize: 12,
      lineHeight: 17,
    },
    optionSubheadActive: {
      color: palette.heroSubtitle,
    },
    optionMetaRow: {
      marginTop: 12,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    optionMetaPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: isDark ? palette.line : '#CFE0EE',
      backgroundColor: isDark ? '#152636' : '#F3F8FC',
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    optionMetaPillActive: {
      borderColor: 'rgba(255,255,255,0.22)',
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    optionMetaText: {
      color: palette.ink700,
      fontSize: 11,
      fontWeight: '700',
    },
    optionMetaTextActive: {
      color: palette.onAccent,
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: isDark ? '#15312D' : '#E8F7F6',
    },
    badgeActive: {
      backgroundColor: isDark ? '#17374D' : '#D9FBFF',
    },
    badgeLabel: {
      color: palette.teal600,
      fontSize: 11,
      fontWeight: '800',
    },
    badgeLabelActive: {
      color: isDark ? palette.ink900 : '#164E63',
    },
    selectionCard: {
      gap: 6,
      backgroundColor: isDark ? '#112B24' : '#ECFCF8',
      borderColor: isDark ? '#1A655E' : '#A7E8DD',
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    selectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    selectionIcon: {
      width: 30,
      height: 30,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#123A37' : '#DDF7F3',
      borderWidth: 1,
      borderColor: isDark ? '#1FAF9E' : '#9EDFD6',
    },
    selectionCopy: {
      flex: 1,
      gap: 1,
    },
    selectionTitle: {
      color: palette.ink900,
      fontSize: 14,
      fontWeight: '800',
    },
    selectionBody: {
      color: palette.ink700,
      fontSize: 11,
      lineHeight: 15,
    },
    checkpointCard: {
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    checkpointCardPressed: {
      transform: [{ scale: 0.99 }],
    },
    checkpointCardDue: {
      backgroundColor: isDark ? '#182235' : '#F2F6FF',
      borderColor: isDark ? '#334769' : '#C7D7F5',
    },
    checkpointCardComplete: {
      backgroundColor: isDark ? '#112B24' : '#ECFCF8',
      borderColor: isDark ? '#1A655E' : '#A7E8DD',
    },
    checkpointHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    checkpointIcon: {
      width: 34,
      height: 34,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#123A37' : '#DDF7F3',
      borderWidth: 1,
      borderColor: isDark ? '#1FAF9E' : '#9EDFD6',
    },
    checkpointCopy: {
      flex: 1,
      gap: 2,
    },
    checkpointTitleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
    },
    checkpointSiteName: {
      flexShrink: 1,
      color: palette.ink900,
      fontSize: 12,
      fontWeight: '900',
    },
    checkpointStatusBadge: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    checkpointStatusDone: {
      borderColor: isDark ? '#1FAF9E' : '#9EDFD6',
      backgroundColor: isDark ? '#123A37' : '#DDF7F3',
    },
    checkpointStatusPending: {
      borderColor: isDark ? '#8A6514' : '#F7D6A7',
      backgroundColor: isDark ? '#33240B' : '#FFF5E8',
    },
    checkpointStatusText: {
      color: palette.ink900,
      fontSize: 9,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    checkpointTitle: {
      color: palette.ink900,
      fontSize: 15,
      fontWeight: '900',
    },
    checkpointBody: {
      color: palette.ink700,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '700',
    },
    checkpointHint: {
      color: palette.ink500,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: '700',
    },
    statusStripCard: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      padding: 10,
    },
    statusStripItem: {
      minWidth: 96,
      flexGrow: 1,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: isDark ? palette.mist : '#F4F9FE',
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    statusStripLabel: {
      color: palette.ink500,
      fontSize: 9,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    statusStripValue: {
      marginTop: 3,
      color: palette.ink900,
      fontSize: 12,
      fontWeight: '900',
    },
    offlineCard: {
      gap: 12,
      backgroundColor: isDark ? '#182235' : '#F2F6FF',
      borderColor: isDark ? '#334769' : '#C7D7F5',
    },
    geofenceCard: {
      gap: 12,
      backgroundColor: isDark ? '#102738' : '#F0FAFF',
      borderColor: isDark ? '#235979' : '#B7E5F4',
    },
    geofenceHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    geofenceIcon: {
      width: 36,
      height: 36,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#173A4D' : '#DDF5FC',
      borderWidth: 1,
      borderColor: isDark ? '#2A7694' : '#A5DDED',
    },
    geofenceCopy: {
      flex: 1,
      gap: 2,
    },
    geofenceTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      flexWrap: 'wrap',
    },
    geofenceTitle: {
      color: palette.ink900,
      fontSize: 15,
      fontWeight: '800',
    },
    geofenceBody: {
      color: palette.ink700,
      fontSize: 12,
      lineHeight: 18,
    },
    zoneBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: 1,
    },
    zoneBadge_inside: {
      backgroundColor: isDark ? '#112B24' : '#E7F8F1',
      borderColor: isDark ? '#1A655E' : '#9ADFC8',
    },
    zoneBadge_outside: {
      backgroundColor: isDark ? '#24161B' : '#FFF0F2',
      borderColor: isDark ? '#70464A' : '#F0AAB4',
    },
    zoneBadge_accuracy: {
      backgroundColor: isDark ? '#30240F' : '#FFF8E8',
      borderColor: isDark ? '#6F561D' : '#E9C76F',
    },
    zoneBadge_checking: {
      backgroundColor: isDark ? '#172638' : '#EEF6FF',
      borderColor: isDark ? '#31506E' : '#BBD8F6',
    },
    zoneBadge_needed: {
      backgroundColor: isDark ? '#172638' : '#EEF6FF',
      borderColor: isDark ? '#31506E' : '#BBD8F6',
    },
    zoneBadge_inactive: {
      backgroundColor: isDark ? '#202936' : '#F3F6FA',
      borderColor: isDark ? '#3A4656' : '#D7E0EA',
    },
    zoneBadgeText: {
      color: palette.ink900,
      fontSize: 11,
      fontWeight: '800',
    },
    offlineHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    offlineIcon: {
      width: 36,
      height: 36,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#223353' : '#E2EBFF',
      borderWidth: 1,
      borderColor: isDark ? '#435B86' : '#BCD0F3',
    },
    offlineCopy: {
      flex: 1,
      gap: 2,
    },
    offlineTitle: {
      color: palette.ink900,
      fontSize: 15,
      fontWeight: '800',
    },
    offlineBody: {
      color: palette.ink700,
      fontSize: 12,
      lineHeight: 18,
    },
    skeletonCard: {
      backgroundColor: isDark ? '#101E2B' : '#F7FBFF',
      borderColor: palette.line,
    },
    skeletonBlock: {
      backgroundColor: isDark ? '#1B3145' : '#DDEAF6',
      borderRadius: 999,
    },
    skeletonIcon: {
      width: 34,
      height: 34,
      borderRadius: 999,
    },
    skeletonSquareIcon: {
      width: 34,
      height: 34,
      borderRadius: 12,
    },
    skeletonTitleLine: {
      width: 120,
      height: 12,
    },
    skeletonBodyLine: {
      width: '82%',
      height: 14,
      marginTop: 4,
    },
    skeletonShortLine: {
      width: '46%',
      height: 11,
      marginTop: 4,
    },
    skeletonTinyLine: {
      width: 42,
      height: 8,
    },
    skeletonValueLine: {
      width: 64,
      height: 13,
      marginTop: 6,
    },
    skeletonBadge: {
      width: 78,
      height: 20,
    },
    skeletonBadgeWide: {
      width: 86,
      height: 24,
    },
    skeletonOptionTitle: {
      width: '64%',
      height: 15,
    },
    skeletonOptionBody: {
      width: '92%',
      height: 11,
      marginTop: 7,
    },
    skeletonOptionBodyShort: {
      width: '58%',
      height: 11,
      marginTop: 5,
    },
    skeletonPill: {
      width: 92,
      height: 25,
    },
    skeletonPillShort: {
      width: 78,
      height: 25,
    },
  }, responsiveMetrics, { exclude: ['siteAccent.left', 'siteAccent.right'] }));
}
