import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGetToken } from '@/components/auth-provider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { SIZE_LABELS, SIZES, type ListingSize } from '@/data/sample-listings';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { createListing, updateProfile } from '@/lib/api';
import { isHostedUri, uploadImage } from '@/lib/cloudinary';
import { useProfileStore } from '@/store/profile';

const AMENITY_PRESETS = [
  'Parking',
  'Wi-Fi',
  'Water',
  'Security',
  'Backup generator',
  'CCTV',
  'Gym',
  'Garden',
  'Borehole water',
  'Furnished',
  'Balcony',
  'Caretaker on-site',
];

const RULE_SUGGESTIONS = [
  'No pets',
  'Quiet hours after 10 pm',
  'Rent due by the 5th',
  'Notice period: 2 months',
];

const MAX_PHOTOS = 8;

export default function NewListingScreen() {
  const realtorStatus = useProfileStore((s) => s.realtorStatus);
  if (realtorStatus !== 'approved') return <NotApproved />;
  return <ListingForm />;
}

/** Shown when someone lands here without an approved realtor account. */
function NotApproved() {
  const router = useRouter();
  return (
    <ThemedView style={styles.container}>
      <View style={styles.notApproved}>
        <ThemedText style={styles.notApprovedTitle}>Realtor access only</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.notApprovedText}>
          Only approved realtors can publish listings. Apply from the Profile tab and check back
          once your application is approved.
        </ThemedText>
        <Pressable
          onPress={() => router.replace('/')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.submitButton, pressed && styles.pressed]}>
          <ThemedText style={styles.submitButtonText}>← Back to homes</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

/** Shown after POST /api/listings succeeds — the listing is pending approval. */
function SubmittedView({ title }: { title: string }) {
  const router = useRouter();
  return (
    <ThemedView style={styles.container}>
      <View style={styles.notApproved}>
        <View style={styles.successIcon}>
          <ThemedText style={styles.successIconGlyph}>✓</ThemedText>
        </View>
        <ThemedText style={styles.notApprovedTitle}>Submitted for review</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.notApprovedText}>
          “{title}” is now pending admin approval. Once approved, it will appear on the home
          feed for tenants to discover.
        </ThemedText>
        <Pressable
          onPress={() => router.replace('/')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.submitButton, pressed && styles.pressed]}>
          <ThemedText style={styles.submitButtonText}>← Back to homes</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

function ListingForm() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const isDark = scheme !== 'light';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const getToken = useGetToken();
  const profilePhone = useProfileStore((s) => s.phone);

  const [photos, setPhotos] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [size, setSize] = useState<ListingSize | null>(null);
  const [neighborhood, setNeighborhood] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState(profilePhone);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [amenityDraft, setAmenityDraft] = useState('');
  const [rules, setRules] = useState<string[]>([]);
  const [ruleDraft, setRuleDraft] = useState('');
  const [description, setDescription] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadText, setUploadText] = useState<string | null>(null);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const inputStyle = [
    styles.input,
    {
      color: theme.text,
      borderColor: theme.backgroundSelected,
      backgroundColor: isDark ? '#161616' : '#FFFFFF',
    },
  ];

  const toggleAmenity = (amenity: string) =>
    setAmenities((current) =>
      current.includes(amenity)
        ? current.filter((a) => a !== amenity)
        : [...current, amenity],
    );

  const addCustomAmenity = () => {
    const value = amenityDraft.trim();
    if (!value) return;
    if (!amenities.includes(value)) setAmenities((current) => [...current, value]);
    setAmenityDraft('');
  };

  const addRule = (rule: string) => {
    const value = rule.trim();
    if (!value || rules.includes(value)) return;
    setRules((current) => [...current, value]);
    setRuleDraft('');
  };

  /** Gallery (multi on native, single on web) or camera → append to the photo list. */
  const pickPhotos = async (source: 'library' | 'camera') => {
    setError(null);
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setError('Camera permission was denied. You can enable it in your device settings.');
          return;
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          setError('Photo library permission was denied. You can enable it in your device settings.');
          return;
        }
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: false,
        allowsMultipleSelection: Platform.OS !== 'web',
        quality: 0.8,
      };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

      if (!result.canceled && result.assets.length > 0) {
        const picked = result.assets.map((asset) => asset.uri).filter(Boolean) as string[];
        setPhotos((current) => [...current, ...picked].slice(0, MAX_PHOTOS));
        setPhotoSheetOpen(false);
      }
    } catch {
      setError('Could not open the camera or gallery on this device.');
    }
  };

  const removePhoto = (index: number) =>
    setPhotos((current) => current.filter((_, i) => i !== index));

  const handlePublish = async () => {
    const priceNum = Number(price.replace(/[^0-9]/g, ''));
    if (photos.length === 0) return setError('Add at least one photo of the apartment.');
    if (!title.trim()) return setError('Give the apartment a name.');
    if (!priceNum || priceNum <= 0) return setError('Enter the monthly rent in KES.');
    if (!size) return setError('Pick the apartment size.');
    if (!neighborhood.trim()) return setError('Enter the neighbourhood.');
    if (!description.trim()) return setError('Write a short description of the apartment.');

    setError(null);
    setSubmitting(true);
    try {
      const token = await getToken();
      // The listing's Call/WhatsApp buttons use the realtor's profile phone —
      // save it to the account when the form's number differs.
      const phoneToSave = phone.trim();
      if (phoneToSave && phoneToSave !== profilePhone) {
        try {
          await updateProfile({ phone: phoneToSave }, token);
        } catch {
          // Best-effort: don't block publishing over a contact-sync hiccup.
        }
      }
      // Upload picker photos to Cloudinary so they load on every device.
      const hostedImages: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const uri = photos[i];
        setUploadText(`Uploading photos ${i + 1}/${photos.length}…`);
        hostedImages.push(isHostedUri(uri) ? uri : await uploadImage(uri, 'nairobi-rentals/listings'));
      }
      setUploadText('Publishing…');
      await createListing(
        {
          title: title.trim(),
          description: description.trim(),
          price: priceNum,
          size,
          neighborhood: neighborhood.trim(),
          addressText: address.trim() || neighborhood.trim(),
          // Nairobi city centre stand-in — precise pins come with Phase 3 geocoding.
          lat: -1.2864,
          lng: 36.8172,
          unitAmenities: [...amenities],
          houseRules: [...rules],
          images: hostedImages,
        },
        token,
      );
      setSubmitted(title.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t publish the listing. Try again.');
    } finally {
      setSubmitting(false);
      setUploadText(null);
    }
  };

  if (submitted) {
    return <SubmittedView title={submitted} />;
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.six }]}>
        {/* Header */}
        <View style={[styles.headerRow, { paddingTop: insets.top + Spacing.two }]}>
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [
              styles.headerButton,
              { backgroundColor: theme.backgroundElement },
              pressed && styles.pressed,
            ]}>
            <ThemedText style={styles.headerBackGlyph}>←</ThemedText>
          </Pressable>
          <View style={styles.headerText}>
            <ThemedText style={styles.headerTitle}>Post a listing</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Publish to tenants across Nairobi
            </ThemedText>
          </View>
        </View>

        {/* Photos */}
        <ThemedView type="backgroundElement" style={styles.card}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>Photos</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {photos.length}/{MAX_PHOTOS}
            </ThemedText>
          </View>
          <View style={styles.photoRow}>
            {photos.map((uri, index) => (
              <View key={`${uri}-${index}`} style={styles.photoTile}>
                <Image source={{ uri }} style={styles.photoImage} contentFit="cover" transition={200} />
                <Pressable
                  onPress={() => removePhoto(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove photo ${index + 1}`}
                  style={({ pressed }) => [styles.photoRemove, pressed && styles.pressed]}>
                  <ThemedText type="small" style={styles.photoRemoveGlyph}>
                    ✕
                  </ThemedText>
                </Pressable>
              </View>
            ))}
            {photos.length < MAX_PHOTOS && (
              <Pressable
                onPress={() => {
                  setError(null);
                  setPhotoSheetOpen(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Add photos"
                style={({ pressed }) => [
                  styles.addPhotoTile,
                  { borderColor: theme.backgroundSelected },
                  pressed && styles.pressed,
                ]}>
                <ThemedText style={[styles.addPhotoGlyph, { color: theme.textSecondary }]}>＋</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Add photos
                </ThemedText>
              </Pressable>
            )}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Show the living room, kitchen, bedroom and outside view. At least one is required.
          </ThemedText>
        </ThemedView>

        {/* Basics */}
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText style={styles.cardTitle}>Basics</ThemedText>

          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary">
              Apartment name
            </ThemedText>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Kilimani Sunrise Apartments"
              placeholderTextColor={theme.textSecondary}
              style={inputStyle}
              accessibilityLabel="Apartment name"
            />
          </View>

          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary">
              Monthly rent (KES)
            </ThemedText>
            <TextInput
              value={price}
              onChangeText={setPrice}
              placeholder="e.g. 45000"
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              style={inputStyle}
              accessibilityLabel="Monthly rent in KES"
            />
          </View>

          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary">
              Size
            </ThemedText>
            <View style={styles.chipWrap}>
              {SIZES.map((option) => {
                const selected = size === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setSize(option)}
                    accessibilityRole="button"
                    accessibilityLabel={SIZE_LABELS[option]}
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.chip,
                      {
                        backgroundColor: selected
                          ? Brand.primary
                          : theme.backgroundSelected,
                      },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText
                      type="smallBold"
                      style={selected ? styles.chipTextSelected : undefined}
                      themeColor={selected ? undefined : 'text'}>
                      {SIZE_LABELS[option]}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary">
              Neighbourhood
            </ThemedText>
            <TextInput
              value={neighborhood}
              onChangeText={setNeighborhood}
              placeholder="e.g. Kilimani"
              placeholderTextColor={theme.textSecondary}
              style={inputStyle}
              accessibilityLabel="Neighbourhood"
            />
          </View>

          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary">
              Street / estate (optional)
            </ThemedText>
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="e.g. Argwings Kodhek Rd"
              placeholderTextColor={theme.textSecondary}
              style={inputStyle}
              accessibilityLabel="Street or estate"
            />
          </View>
        </ThemedView>

        {/* Contact */}
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText style={styles.cardTitle}>Contact</ThemedText>
          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary">
              Phone number (calls &amp; WhatsApp)
            </ThemedText>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="07XX XXX XXX"
              placeholderTextColor={theme.textSecondary}
              keyboardType="phone-pad"
              style={inputStyle}
              accessibilityLabel="Phone number"
            />
            <ThemedText type="small" themeColor="textSecondary">
              Tenants reach you here — it appears on the listing's Call and WhatsApp buttons.
            </ThemedText>
          </View>
        </ThemedView>

        {/* Amenities */}
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText style={styles.cardTitle}>Amenities</ThemedText>
          <View style={styles.chipWrap}>
            {AMENITY_PRESETS.map((amenity) => {
              const selected = amenities.includes(amenity);
              return (
                <Pressable
                  key={amenity}
                  onPress={() => toggleAmenity(amenity)}
                  accessibilityRole="button"
                  accessibilityLabel={amenity}
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      backgroundColor: selected
                        ? Brand.primary
                        : theme.backgroundSelected,
                    },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText
                    type="smallBold"
                    style={selected ? styles.chipTextSelected : undefined}
                    themeColor={selected ? undefined : 'text'}>
                    {selected ? `✓ ${amenity}` : amenity}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.addRow}>
            <TextInput
              value={amenityDraft}
              onChangeText={setAmenityDraft}
              placeholder="Add a custom amenity…"
              placeholderTextColor={theme.textSecondary}
              onSubmitEditing={addCustomAmenity}
              returnKeyType="done"
              style={[inputStyle, styles.addInput]}
              accessibilityLabel="Custom amenity"
            />
            <Pressable
              onPress={addCustomAmenity}
              accessibilityRole="button"
              accessibilityLabel="Add amenity"
              style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
              <ThemedText type="smallBold" style={styles.whiteText}>
                Add
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>

        {/* House rules */}
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText style={styles.cardTitle}>House rules</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Quick add:
          </ThemedText>
          <View style={styles.chipWrap}>
            {RULE_SUGGESTIONS.filter((rule) => !rules.includes(rule)).map((rule) => (
              <Pressable
                key={rule}
                onPress={() => addRule(rule)}
                accessibilityRole="button"
                accessibilityLabel={`Add rule: ${rule}`}
                style={({ pressed }) => [
                  styles.chip,
                  { backgroundColor: theme.backgroundSelected },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" themeColor="text" style={styles.ruleChipText}>
                  ＋ {rule}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          {rules.length > 0 && (
            <View style={styles.rulesList}>
              {rules.map((rule) => (
                <View key={rule} style={styles.ruleRow}>
                  <View style={[styles.ruleDot, { backgroundColor: Brand.primary }]} />
                  <ThemedText type="small" style={styles.ruleText}>
                    {rule}
                  </ThemedText>
                  <Pressable
                    onPress={() => setRules((current) => current.filter((r) => r !== rule))}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove rule: ${rule}`}
                    hitSlop={10}
                    style={({ pressed }) => pressed && styles.pressed}>
                    <ThemedText type="small" themeColor="textSecondary">
                      ✕
                    </ThemedText>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <View style={styles.addRow}>
            <TextInput
              value={ruleDraft}
              onChangeText={setRuleDraft}
              placeholder="Add your own rule…"
              placeholderTextColor={theme.textSecondary}
              onSubmitEditing={() => addRule(ruleDraft)}
              returnKeyType="done"
              style={[inputStyle, styles.addInput]}
              accessibilityLabel="Custom house rule"
            />
            <Pressable
              onPress={() => addRule(ruleDraft)}
              accessibilityRole="button"
              accessibilityLabel="Add house rule"
              style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
              <ThemedText type="smallBold" style={styles.whiteText}>
                Add
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>

        {/* Description */}
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText style={styles.cardTitle}>Description</ThemedText>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What makes this home special? Size, finishes, views, nearby schools and malls…"
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            style={[inputStyle, styles.descriptionInput]}
            accessibilityLabel="Description"
          />
        </ThemedView>

        {error && (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        )}

        {uploadText && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.uploadText}>
            {uploadText}
          </ThemedText>
        )}

        <Pressable
          onPress={() => void handlePublish()}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Publish listing"
          style={({ pressed }) => [
            styles.submitButton,
            { backgroundColor: submitting ? Brand.primaryStrong : Brand.primary },
            pressed && styles.pressed,
          ]}>
          {submitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <ThemedText style={styles.submitButtonText}>Publish listing</ThemedText>
          )}
        </Pressable>
      </ScrollView>

      {/* Photo source sheet */}
      <Modal
        visible={photoSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoSheetOpen(false)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setPhotoSheetOpen(false)}>
          <Pressable style={[styles.sheetCard, { backgroundColor: theme.background }]} onPress={() => {}}>
            <ThemedText style={styles.sheetTitle}>Add photos</ThemedText>

            <Pressable
              onPress={() => pickPhotos('library')}
              accessibilityRole="button"
              accessibilityLabel="Choose photos from gallery"
              style={({ pressed }) => [styles.sheetOption, pressed && styles.pressed]}>
              <ThemedText style={styles.sheetOptionText}>🖼  Choose from gallery</ThemedText>
            </Pressable>

            <Pressable
              onPress={() => pickPhotos('camera')}
              accessibilityRole="button"
              accessibilityLabel="Take a photo with the camera"
              style={({ pressed }) => [styles.sheetOption, pressed && styles.pressed]}>
              <ThemedText style={styles.sheetOptionText}>📷  Take a photo</ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setPhotoSheetOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={({ pressed }) => [styles.sheetCancel, pressed && styles.pressed]}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Cancel
              </ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: Spacing.two,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBackGlyph: {
    fontSize: 18,
    lineHeight: 22,
  },
  headerText: {
    flex: 1,
    gap: Spacing.half,
  },
  headerTitle: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: 800,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: 700,
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  photoTile: {
    width: 84,
    height: 84,
    borderRadius: Spacing.two,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveGlyph: {
    color: '#ffffff',
    fontSize: 12,
    lineHeight: 14,
  },
  addPhotoTile: {
    width: 84,
    height: 84,
    borderRadius: Spacing.two,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addPhotoGlyph: {
    fontSize: 26,
    lineHeight: 30,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 16,
  },
  descriptionInput: {
    minHeight: 120,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  chipTextSelected: {
    color: '#ffffff',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  addInput: {
    flex: 1,
  },
  addButton: {
    backgroundColor: Brand.primary,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.four,
  },
  whiteText: {
    color: '#ffffff',
  },
  rulesList: {
    gap: Spacing.two,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  ruleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  ruleText: {
    flex: 1,
  },
  ruleChipText: {
    fontSize: 13,
    lineHeight: 18,
  },
  error: {
    color: '#DC2626',
    textAlign: 'center',
  },
  uploadText: {
    textAlign: 'center',
  },
  submitButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  submitButtonText: {
    color: '#ffffff',
    fontWeight: 700,
    fontSize: 16,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheetCard: {
    width: '100%',
    maxWidth: 520,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.two,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: Spacing.one,
  },
  sheetOption: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    backgroundColor: 'rgba(128, 128, 128, 0.12)',
  },
  sheetOptionText: {
    fontSize: 16,
    fontWeight: 600,
  },
  sheetCancel: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  notApproved: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  notApprovedTitle: {
    fontSize: 20,
    fontWeight: 700,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIconGlyph: {
    color: '#ffffff',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: 800,
  },
  notApprovedText: {
    textAlign: 'center',
    maxWidth: 320,
  },
  pressed: {
    opacity: 0.7,
  },
});
