import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, Platform, TextInputProps, TouchableOpacity, View } from 'react-native';

import { nb } from '@/src/i18n/nb';
import {
  Body,
  Caption,
  GlassCard,
  SecondaryButton,
  TextField,
  useAppTheme,
} from '@/src/ui';

import { ReportBuilding, ReportContributor, ReportMeta } from './types';

// Rapporten og værdata-oppslaget krever ÅÅÅÅ-MM-DD (se skadedato-effekten i
// app/projects/[id].tsx). Tomt felt er lov.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const dateError = (value: string | undefined) => {
  const v = (value ?? '').trim();
  if (!v) return undefined;
  // Ikke mas mens datoen skrives: vurder først når den er komplett lang,
  // eller straks den inneholder tegn som aldri hører hjemme i ÅÅÅÅ-MM-DD.
  const stillTyping = v.length < 10 && /^[\d-]*$/.test(v);
  if (stillTyping) return undefined;
  if (!ISO_DATE.test(v) || Number.isNaN(new Date(v).getTime())) {
    return 'Skriv datoen som ÅÅÅÅ-MM-DD, f.eks. 2026-03-14.';
  }
  return undefined;
};

type FieldOptions = {
  placeholder: string;
  multiline?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  error?: string;
  helperText?: string;
};

const PHONE: Partial<FieldOptions> = {
  keyboardType: 'phone-pad',
  autoComplete: 'tel',
  textContentType: 'telephoneNumber',
};
const EMAIL: Partial<FieldOptions> = {
  keyboardType: 'email-address',
  autoComplete: 'email',
  textContentType: 'emailAddress',
  autoCapitalize: 'none',
};
const DATE: Partial<FieldOptions> = {
  keyboardType: 'numbers-and-punctuation',
  autoComplete: 'off',
};

/** Bekreft destruktive valg — Alert.alert med flere knapper er no-op på web. */
const confirmRemove = (title: string, message: string, onConfirm: () => void) => {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: nb.common.cancel, style: 'cancel' },
    { text: 'Fjern', style: 'destructive', onPress: onConfirm },
  ]);
};

type Props = {
  meta: ReportMeta;
  onChange: (meta: ReportMeta) => void;
  isOpen: boolean;
  onToggle: () => void;
  saveStatus?: 'idle' | 'saving' | 'saved';
  saveError?: string | null;
};

export function ReportDetailsSection({ meta, onChange, isOpen, onToggle, saveStatus, saveError }: Props) {
  const theme = useAppTheme();

  // ----- helpers -----

  const setField = <K extends keyof ReportMeta>(key: K, value: ReportMeta[K]) =>
    onChange({ ...meta, [key]: value });

  const contributors: ReportContributor[] = meta.contributors?.length
    ? meta.contributors
    : [{}];

  const buildings: ReportBuilding[] = meta.buildings?.length
    ? meta.buildings
    : [{}];

  const updateContributor = (i: number, field: keyof ReportContributor, value: string) => {
    const next = [...contributors];
    next[i] = { ...next[i], [field]: value };
    setField('contributors', next);
  };

  const addContributor = () => setField('contributors', [...contributors, {}]);
  const removeContributor = (i: number) =>
    setField('contributors', contributors.filter((_, idx) => idx !== i));

  const updateBuilding = (i: number, field: keyof ReportBuilding, value: string) => {
    const next = [...buildings];
    next[i] = { ...next[i], [field]: value };
    setField('buildings', next);
  };

  const addBuilding = () => setField('buildings', [...buildings, {}]);
  const removeBuilding = (i: number) =>
    setField('buildings', buildings.filter((_, idx) => idx !== i));

  // ----- render helpers -----

  // Etiketten sendes til TextField, så den både vises og kobles til feltet for
  // skjermleser. Plassholderen er et eksempel — aldri «–», som leses som «strek».
  const inputField = (
    label: string,
    value: string | undefined,
    onChangeText: (v: string) => void,
    { multiline = false, ...opts }: FieldOptions,
  ) => (
    <TextField
      label={label}
      value={value ?? ''}
      onChangeText={onChangeText}
      multiline={multiline}
      style={multiline ? { minHeight: 64, textAlignVertical: 'top' } : undefined}
      {...opts}
    />
  );

  const sectionLabel = (title: string) => (
    <Body style={{ fontWeight: '600', marginTop: theme.spacing.xs }}>{title}</Body>
  );

  // ----- component -----

  return (
    <GlassCard style={{ gap: theme.spacing.sm }}>
      {/* Collapsible header */}
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Ionicons name="clipboard-outline" size={18} color={theme.colors.accent} />
          <Body style={{ fontWeight: '600', fontSize: 17 }}>{nb.report.details}</Body>
        </View>
        <Ionicons
          name={isOpen ? 'chevron-up-outline' : 'chevron-down-outline'}
          size={20}
          color={theme.colors.muted}
        />
      </TouchableOpacity>

      {!isOpen && (
        <Caption muted>
          Trykk for å fylle inn saksinfo, takstperson, bygninger og medvirkende til rapporten.
        </Caption>
      )}

      {isOpen && (
        <View style={{ gap: theme.spacing.md }}>

          {/* ── Saksinfo ── */}
          {sectionLabel('Saksinfo')}
          {inputField('Saksnummer', meta.caseNumber, v => setField('caseNumber', v), { placeholder: 'Forsikringsselskapets saksnummer' })}
          {inputField('Arbeidsnummer', meta.workingNumber, v => setField('workingNumber', v), { placeholder: 'Ditt interne arbeidsnummer' })}
          {inputField('Skadedato', meta.damageDate, v => setField('damageDate', v), {
            ...DATE,
            placeholder: 'ÅÅÅÅ-MM-DD',
            error: dateError(meta.damageDate),
            helperText: 'Brukes også til å hente nedbør rundt skadedatoen.',
          })}
          {inputField('Befaringsdato', meta.inspectionDate, v => setField('inspectionDate', v), { ...DATE, placeholder: 'ÅÅÅÅ-MM-DD' })}
          {inputField('Befaringsobjekt / romtype', meta.pictureObject, v => setField('pictureObject', v), { placeholder: 'F.eks. bad i 2. etasje' })}

          {/* ── Takstperson ── */}
          {sectionLabel(nb.projects.inspectorLabel)}
          {inputField(nb.guide.nameLabel, meta.inspectionDoneByName, v => setField('inspectionDoneByName', v), { placeholder: 'Fornavn og etternavn', autoComplete: 'name', textContentType: 'name' })}
          {inputField(nb.guide.phoneLabel, meta.inspectionDoneByPhone, v => setField('inspectionDoneByPhone', v), { ...PHONE, placeholder: 'F.eks. 912 34 567' })}
          {inputField(nb.guide.companyLabel, meta.inspectionDoneByCompany, v => setField('inspectionDoneByCompany', v), { placeholder: 'Firmanavn', autoComplete: 'organization', textContentType: 'organizationName' })}

          {/* ── Forsikring ── */}
          {sectionLabel('Forsikring')}
          {inputField('Forsikringsselskap', meta.insuranceCompany, v => setField('insuranceCompany', v), { placeholder: 'Navn på forsikringsselskapet' })}
          {inputField('Skadebehandler', meta.insuranceAgent, v => setField('insuranceAgent', v), { placeholder: 'Navn på skadebehandleren' })}

          {/* ── Kunde ── */}
          {sectionLabel('Kunde')}
          {inputField('Kundenavn', meta.customerName, v => setField('customerName', v), { placeholder: 'Fornavn og etternavn' })}
          {inputField('Gateadresse', meta.addressStreet, v => setField('addressStreet', v), { placeholder: 'F.eks. Storgata 1' })}
          {inputField('Postnummer og sted', meta.addressPostcodeCity, v => setField('addressPostcodeCity', v), { placeholder: 'F.eks. 0155 Oslo' })}

          {/* ── Medvirkende ── */}
          {sectionLabel('Medvirkende')}
          {contributors.map((c, i) => (
            <View
              key={i}
              style={{
                gap: theme.spacing.sm,
                padding: theme.spacing.sm,
                backgroundColor: theme.colors.surfaceSecondary,
                borderRadius: theme.radii.md,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Caption style={{ fontWeight: '600' }}>Medvirkende {i + 1}</Caption>
                {contributors.length > 1 && (
                  <SecondaryButton
                    tone="danger"
                    accessibilityLabel={`Fjern medvirkende ${i + 1}`}
                    onPress={() =>
                      confirmRemove(
                        `Fjerne medvirkende ${i + 1}?`,
                        'Feltene for denne medvirkende slettes fra rapportdetaljene.',
                        () => removeContributor(i),
                      )
                    }
                    width={96}
                  >
                    Fjern
                  </SecondaryButton>
                )}
              </View>
              {inputField(nb.guide.nameLabel, c.name, v => updateContributor(i, 'name', v), { placeholder: 'Fornavn og etternavn' })}
              {inputField('Rolle', c.role, v => updateContributor(i, 'role', v), { placeholder: 'F.eks. rørlegger' })}
              {inputField(nb.guide.phoneLabel, c.phone, v => updateContributor(i, 'phone', v), { ...PHONE, placeholder: 'F.eks. 912 34 567' })}
              {inputField('E-post (valgfritt)', c.email, v => updateContributor(i, 'email', v), { ...EMAIL, placeholder: 'navn@firma.no' })}
            </View>
          ))}
          <SecondaryButton onPress={addContributor}>Legg til medvirkende</SecondaryButton>

          {/* ── Bygninger ── */}
          {sectionLabel('Bygninger')}
          {buildings.map((b, i) => (
            <View
              key={i}
              style={{
                gap: theme.spacing.sm,
                padding: theme.spacing.sm,
                backgroundColor: theme.colors.surfaceSecondary,
                borderRadius: theme.radii.md,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Caption style={{ fontWeight: '600' }}>Bygning {i + 1}</Caption>
                {buildings.length > 1 && (
                  <SecondaryButton
                    tone="danger"
                    accessibilityLabel={`Fjern bygning ${i + 1}`}
                    onPress={() =>
                      confirmRemove(
                        `Fjerne bygning ${i + 1}?`,
                        'Feltene for denne bygningen slettes fra rapportdetaljene.',
                        () => removeBuilding(i),
                      )
                    }
                    width={96}
                  >
                    Fjern
                  </SecondaryButton>
                )}
              </View>
              {inputField('Bygningstype', b.type, v => updateBuilding(i, 'type', v), { placeholder: 'F.eks. enebolig' })}
              {inputField('Areal (m²)', b.size, v => updateBuilding(i, 'size', v), { keyboardType: 'decimal-pad', placeholder: 'F.eks. 120,5' })}
              {inputField('Byggeår', b.buildingYear, v => updateBuilding(i, 'buildingYear', v), { keyboardType: 'number-pad', placeholder: 'F.eks. 1978' })}
              {inputField('Utførte oppgraderinger', b.renovationsDone, v => updateBuilding(i, 'renovationsDone', v), { multiline: true, placeholder: 'F.eks. nytt bad i 2015' })}
              {inputField('Annen informasjon', b.otherInfo, v => updateBuilding(i, 'otherInfo', v), { multiline: true, placeholder: 'Andre forhold ved bygningen' })}
              {inputField('Skadet område – beskrivelse', b.damagedAreaDescription, v => updateBuilding(i, 'damagedAreaDescription', v), { multiline: true, placeholder: 'Hvor er skaden, og hva er skadet' })}
              {inputField('Skadet område – anslått verdi', b.damagedAreaEstimatedValue, v => updateBuilding(i, 'damagedAreaEstimatedValue', v), { keyboardType: 'numeric', placeholder: 'Beløp i kroner' })}
            </View>
          ))}
          <SecondaryButton onPress={addBuilding}>Legg til bygning</SecondaryButton>

          {/* ── Skade og status ── */}
          {sectionLabel('Skade og status')}
          {inputField('Mulig regress', meta.possibleRecourse, v => setField('possibleRecourse', v), { multiline: true, placeholder: 'Hvem kan eventuelt holdes ansvarlig' })}
          {inputField('Tiltak for å hindre fremtidig skade', meta.measuresToPreventFutureDamage, v => setField('measuresToPreventFutureDamage', v), { multiline: true, placeholder: 'Hva bør gjøres for å unngå ny skade' })}
          {inputField('Påbegynte utbedringer', meta.startedRepairs, v => setField('startedRepairs', v), { multiline: true, placeholder: 'Hva er allerede gjort' })}
          {inputField('Verditap per måned (kr)', meta.habitableValueLossPerMonth, v => setField('habitableValueLossPerMonth', v), { keyboardType: 'numeric', placeholder: 'Beløp i kroner' })}
          {inputField('Beboelighet – annen info', meta.habitableOtherInfo, v => setField('habitableOtherInfo', v), { multiline: true, placeholder: 'F.eks. badet kan ikke brukes' })}
          {inputField('Sammendrag', meta.summaryText, v => setField('summaryText', v), { multiline: true, placeholder: 'Kort oppsummering av saken' })}

          {/* Pilotfunn (aug 2026): lagre-knappen ble glemt — feltene autolagres. */}
          {saveError ? (
            <View
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}
              accessibilityRole="alert"
            >
              <View aria-hidden importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <Ionicons name="alert-circle-outline" size={14} color={theme.colors.danger} />
              </View>
              <Caption style={{ color: theme.colors.danger, textAlign: 'center', flexShrink: 1 }}>{saveError}</Caption>
            </View>
          ) : (
            <View
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}
              accessibilityLiveRegion="polite"
            >
              {saveStatus === 'saved' && (
                <View aria-hidden importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                  <Ionicons name="checkmark-circle-outline" size={14} color={theme.colors.muted} />
                </View>
              )}
              <Caption muted style={{ textAlign: 'center', flexShrink: 1 }}>
                {saveStatus === 'saving'
                  ? 'Lagrer …'
                  : saveStatus === 'saved'
                    ? 'Lagret – feltene lagres automatisk mens du skriver'
                    : 'Feltene lagres automatisk mens du skriver'}
              </Caption>
            </View>
          )}
        </View>
      )}
    </GlassCard>
  );
}
