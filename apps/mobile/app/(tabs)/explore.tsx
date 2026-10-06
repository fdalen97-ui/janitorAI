import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';

import { isDevelopment } from '@/src/config/api';
import { nb } from '@/src/i18n/nb';
import { loadProfile, saveProfile, InspectorProfile } from '@/src/storage/profileStorage';
import {
  Body,
  Caption,
  GlassCard,
  Screen,
  SecondaryButton,
  TextField,
  Title,
  useAppTheme,
  useToast,
} from '@/src/ui';

type StepProps = {
  number: string;
  title: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

const Step = ({ number, title, description, icon }: StepProps) => {
  const theme = useAppTheme();
  return (
    <GlassCard style={{ gap: theme.spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <View
          aria-hidden
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={{
            width: 36,
            height: 36,
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={18} color={theme.colors.onAccent} />
        </View>
        <View style={{ flex: 1 }}>
          <Caption muted>{`Steg ${number}`}</Caption>
          <Title accessibilityRole="header" style={{ fontSize: 16 }}>{title}</Title>
        </View>
      </View>
      <Body muted>{description}</Body>
    </GlassCard>
  );
};

const TipRow = ({ text }: { text: string }) => {
  const theme = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm }}>
      <View style={{ paddingTop: 7 }}>
        <Ionicons name="ellipse" size={6} color={theme.colors.muted} />
      </View>
      <Body muted style={{ flex: 1 }}>
        {text}
      </Body>
    </View>
  );
};

export default function GuideScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const toast = useToast();

  const [profile, setProfile] = useState<InspectorProfile>({ name: '', phone: '', company: '' });
  const [isSaving, setIsSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadProfile().then(setProfile);
    }, [])
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveProfile(profile);
      toast.show({
        message: 'Profilen er lagret. Nye prosjekter fylles ut med disse opplysningene.',
        variant: 'success',
      });
    } catch {
      toast.show({ message: 'Kunne ikke lagre profilen. Prøv igjen.', variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: theme.spacing.md }}>
        {/* Header */}
        <View style={{ gap: theme.spacing.xs }}>
          <Caption muted>{nb.tabs.guide}</Caption>
          <Title accessibilityRole="header">{nb.guide.title}</Title>
          <Body muted>
            DocrAI gjør notatene, bildene og lydopptakene fra befaringen om til et rapportutkast.
            Du kontrollerer og godkjenner rapporten før den deles.
          </Body>
        </View>

        {/* Takstpersonprofil */}
        <GlassCard style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Ionicons name="person-circle-outline" size={22} color={theme.colors.accent} />
            <Title accessibilityRole="header" style={{ fontSize: 16 }}>{nb.guide.profileTitle}</Title>
          </View>
          <Body muted>
            Lagre opplysningene dine én gang. De fylles inn under Takstperson i rapportdetaljene når
            du oppretter et nytt prosjekt, og navnet brukes når du godkjenner en rapport.
          </Body>
          <TextField
            label={nb.guide.nameLabel}
            value={profile.name}
            onChangeText={(text) => setProfile((p) => ({ ...p, name: text }))}
            placeholder="Kari Nordmann"
          />
          <TextField
            label={nb.guide.phoneLabel}
            value={profile.phone}
            onChangeText={(text) => setProfile((p) => ({ ...p, phone: text }))}
            placeholder="+47 900 00 000"
            keyboardType="phone-pad"
          />
          <TextField
            label={nb.guide.companyLabel}
            value={profile.company}
            onChangeText={(text) => setProfile((p) => ({ ...p, company: text }))}
            placeholder="Takst AS"
          />
          <SecondaryButton onPress={handleSave} loading={isSaving}>
            Lagre profilen
          </SecondaryButton>
        </GlassCard>

        {/* Steg */}
        <Step
          number="1"
          title="Opprett et prosjekt"
          description="Trykk «Nytt prosjekt» på prosjektsiden. Skriv adressen (velg gjerne forslaget fra Kartverket), befaringsdato og navnet ditt."
          icon="folder-open-outline"
        />
        <Step
          number="2"
          title="Dokumenter befaringen"
          description="Åpne prosjektet og legg til notater mens du går befaringen: skriv observasjoner, ta lydopptak, ta bilder eller legg ved korte videoklipp."
          icon="create-outline"
        />
        <Step
          number="3"
          title="Beskriv og transkriber"
          description="Trykk «Beskriv automatisk» på et bilde for å få et forslag til bildetekst. Trykk «Transkriber» på et lydnotat for å gjøre tale om til tekst."
          icon="sparkles-outline"
        />
        <Step
          number="4"
          title="Lag rapporten"
          description="Gå til Rapport-fanen i prosjektet og trykk «Lag rapport». KI-en bruker notatene, bildene og transkripsjonene dine til å skrive et rapportutkast. Det kan ta noen minutter."
          icon="document-text-outline"
        />
        <Step
          number="5"
          title="Kontroller og godkjenn"
          description="Les gjennom utkastet og rett direkte i rapporten. Kontroller årsak og om skaden er akutt eller gradvis, og trykk «Godkjenn rapport». Du står faglig ansvarlig for innholdet."
          icon="checkmark-done-outline"
        />
        <Step
          number="6"
          title="Del rapporten"
          description="Når rapporten er godkjent, trykker du «Lag delingslenke». Mottakeren åpner lenken uten konto og låser opp med en PIN-kode, som du sender i en annen kanal. Du kan også laste ned rapporten som PDF eller Word."
          icon="share-outline"
        />

        {/* Tips */}
        <GlassCard style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Ionicons name="information-circle-outline" size={22} color={theme.colors.accent} />
            <Title accessibilityRole="header" style={{ fontSize: 16 }}>Tips for best resultat</Title>
          </View>
          <View style={{ gap: theme.spacing.xs }}>
            <TipRow text="Bilder kan være opptil 50 MB og videoklipp opptil 500 MB. Appen varsler deg hvis en fil er for stor." />
            <TipRow text="Videoklipp kan være opptil 2 minutter lange." />
            <TipRow text="Skriv en kort prosjektbeskrivelse, så vet KI-en hva den skal se etter." />
            <TipRow text="Transkriber lydnotatene før du lager rapporten." />
            <TipRow text="Uten nett lagres alt på enheten. Trykk på synkstatusen øverst på prosjektsiden for å synkronisere når du er på nett igjen." />
          </View>
        </GlassCard>

        {/* Tilgang */}
        <GlassCard style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Ionicons name="key-outline" size={22} color={theme.colors.accent} />
            <Title accessibilityRole="header" style={{ fontSize: 16 }}>{nb.auth.accessTitle}</Title>
          </View>
          <Body muted>
            Du trenger en tilgangskode for å synkronisere og bruke KI-funksjonene. Skriv den inn ved å
            trykke på nøkkelikonet øverst på prosjektsiden.
          </Body>
        </GlassCard>

        {/* Dev debug link */}
        {isDevelopment() && (
          <SecondaryButton onPress={() => router.push('/debug' as any)}>
            Feilsøkingsinfo
          </SecondaryButton>
        )}
      </View>
    </Screen>
  );
}
