import React, { useState, useEffect } from 'react';
import { View, Pressable, Text } from 'react-native';
import styles from '../styles/styles';
import { SecondaryButton } from '../components';
import { TodoService } from '../services/todoService';
import { TodoItem } from '../types';

interface HomeScreenProps {
  onOpenTravel: () => void;
  onOpenDining: () => void;
  onOpenInbox: () => void;
}

const PRIORITY_COLOR: Record<string, string> = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#10B981',
};

export function HomeScreen({ onOpenTravel, onOpenDining, onOpenInbox }: HomeScreenProps) {
  const [todos, setTodos] = useState<TodoItem[]>([]);

  useEffect(() => {
    setTodos([...TodoService.getTodos()]);
  }, []);

  const toggleTodo = (id: string) => {
    const updated = TodoService.toggleTodo(id);
    setTodos([...updated]);
  };

  const { completed, total, progressPct } = TodoService.getProgressStats();

  return (
    <View>
      {/* Hero Card */}
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Executive utility</Text>
        <Text style={styles.heroTitle}>Everything you need is one prompt away.</Text>
        <Text style={styles.heroText}>
          Travel, dining, and inbox replies are coordinated in one calm flow.
        </Text>
        <SecondaryButton text="Start a new request" onPress={onOpenTravel} />
      </View>

      {/* Popular Actions */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Popular actions</Text>
      </View>

      <Pressable style={styles.moduleCard} onPress={onOpenTravel}>
        <View style={[styles.iconWrap, styles.navyTint]}>
          <Text style={styles.iconText}>✈️</Text>
        </View>
        <View style={styles.moduleBody}>
          <Text style={styles.moduleTitle}>Travel & hotels</Text>
          <Text style={styles.moduleSub}>Flights, stays, and itinerary updates</Text>
        </View>
      </Pressable>

      <Pressable style={styles.moduleCard} onPress={onOpenDining}>
        <View style={[styles.iconWrap, styles.rustTint]}>
          <Text style={styles.iconText}>🍽️</Text>
        </View>
        <View style={styles.moduleBody}>
          <Text style={styles.moduleTitle}>Dining</Text>
          <Text style={styles.moduleSub}>Discover a quiet place and reserve it</Text>
        </View>
      </Pressable>

      <Pressable style={styles.moduleCard} onPress={onOpenInbox}>
        <View style={[styles.iconWrap, styles.goldTint]}>
          <Text style={styles.iconText}>📧</Text>
        </View>
        <View style={styles.moduleBody}>
          <Text style={styles.moduleTitle}>Inbox & replies</Text>
          <Text style={styles.moduleSub}>Review highlights and send polished replies</Text>
        </View>
      </Pressable>

      {/* Today's TODO Section — after Popular actions */}
      <View style={styles.todoSectionHeader}>
        <Text style={styles.sectionTitle}>Today's tasks</Text>
        <Text style={styles.todoProgress}>{completed}/{total} done</Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.todoProgressBar}>
        <View style={[styles.todoProgressFill, { width: `${progressPct}%` as any }]} />
      </View>

      {/* TODO Items */}
      {todos.map(todo => (
        <Pressable
          key={todo.id}
          style={[styles.todoCard, todo.done && styles.todoCardDone]}
          onPress={() => toggleTodo(todo.id)}>
          <View style={[styles.todoCheckbox, todo.done && styles.todoCheckboxDone]}>
            {todo.done && <Text style={styles.todoCheckmark}>✓</Text>}
          </View>
          <View style={styles.todoBody}>
            <Text style={[styles.todoLabel, todo.done && styles.todoLabelDone]}>
              {todo.label}
            </Text>
          </View>
          <View style={[styles.todoPriorityDot, { backgroundColor: PRIORITY_COLOR[todo.priority] }]} />
        </Pressable>
      ))}
    </View>
  );
}
