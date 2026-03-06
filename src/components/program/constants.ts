import type { AddSlotForm } from './types';

export const DAY_OPTIONS = [
  { value: 'monday', label: 'ΔΕΥΤΕΡΑ' },
  { value: 'tuesday', label: 'ΤΡΙΤΗ' },
  { value: 'wednesday', label: 'ΤΕΤΑΡΤΗ' },
  { value: 'thursday', label: 'ΠΕΜΠΤΗ' },
  { value: 'friday', label: 'ΠΑΡΑΣΚΕΥΗ' },
  { value: 'saturday', label: 'ΣΑΒΒΑΤΟ' },
  { value: 'sunday', label: 'ΚΥΡΙΑΚΗ' },
];

export const DAY_LABEL_BY_VALUE: Record<string, string> = DAY_OPTIONS.reduce(
  (acc, d) => { acc[d.value] = d.label; return acc; },
  {} as Record<string, string>
);

export const emptyAddSlotForm: AddSlotForm = {
  classId: null,
  subjectId: null,
  tutorId: null,
  day: '',
  startTime: '',
  startPeriod: 'PM',
  endTime: '',
  endPeriod: 'PM',
  startDate: '',
  endDate: '',
};
