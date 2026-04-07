import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
} from 'react-native';

import { getColors, getReminderColor } from '../../utils/colors';
import { getAllReminders } from '../../services/reminder/reminderRepository';
import { Reminder } from '../../domain/reminder';
import { formatSyncStatus } from '../../utils/recurrenceFormat';

type Props = {
  onSelect: (reminder: Reminder) => void;
  refreshKey?: number;
};

export function ReminderList({ onSelect, refreshKey }: Props) {
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReminders = useCallback(async () => {
    try {
      setLoading(true);
      const items = await getAllReminders();
      setReminders(items);
    } catch (e) {
      console.error('[REMINDER][LIST][ERROR]', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReminders();
  }, [loadReminders, refreshKey]);

  const renderItem = ({ item }: { item: Reminder }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onSelect(item)}
      style={[styles.card, { borderColor: colors.inputBorder }]}
    >
      <Text style={[styles.title, { color: colors.text }]}>
        {item.title}
      </Text>

      <Text style={[styles.meta, { color: colors.text }]}>
        {item.startDate} — {item.time}
      </Text>

      <Text
        style={[styles.message, { color: colors.text }]}
        numberOfLines={2}
      >
        {item.message}
      </Text>

      <Text
        style={[
          styles.status,
          { color: getReminderColor(item.status, item.syncStatus) }
        ]}
      >
        {formatSyncStatus(item.syncStatus)}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: colors.text }}>Chargement...</Text>
      </View>
    );
  }

  if (reminders.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: colors.text }}>
          Aucun reminder défini
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={reminders}
      keyExtractor={(r) => r.reminderId}
      renderItem={renderItem}
      contentContainerStyle={styles.listContent}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 10,
  },
  centered: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  meta: {
    fontSize: 14,
    marginTop: 4,
    opacity: 0.8,
    fontWeight: '600',
  },
  message: {
    fontSize: 15,
    marginTop: 6,
  },
  status: {
    fontSize: 12,
    marginTop: 8,
    fontWeight: '600',
  },
});