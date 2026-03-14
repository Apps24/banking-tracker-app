import { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react-native';
import {
  ArrowLeftRight,
  Zap,
  ShoppingBag,
  UtensilsCrossed,
  Car,
  Wallet,
  Landmark,
  Heart,
  GraduationCap,
  Film,
  Banknote,
  MoreHorizontal,
} from 'lucide-react-native';
import { TransactionCategory } from '../types';

export type IconComponent = ComponentType<LucideProps>;

export interface CategoryMeta {
  Icon: IconComponent;
  bg: string;
  color: string;
  label: string;
}

// Keys match the backend Prisma TransactionCategory enum exactly (uppercase).
export const CATEGORY_META: Record<TransactionCategory, CategoryMeta> = {
  TRANSFER:      { Icon: ArrowLeftRight,  bg: '#1E3A5F', color: '#60A5FA', label: 'Transfer'      },
  UTILITIES:     { Icon: Zap,             bg: '#3B2E1A', color: '#F59E0B', label: 'Utilities'     },
  SHOPPING:      { Icon: ShoppingBag,     bg: '#3B1A2E', color: '#F472B6', label: 'Shopping'      },
  FOOD:          { Icon: UtensilsCrossed, bg: '#3B2E1A', color: '#FB923C', label: 'Food'          },
  TRANSPORT:     { Icon: Car,             bg: '#1A2E3B', color: '#38BDF8', label: 'Transport'     },
  SALARY:        { Icon: Wallet,          bg: '#1A3B1A', color: '#4ADE80', label: 'Salary'        },
  ATM:           { Icon: Landmark,        bg: '#2E1A3B', color: '#A78BFA', label: 'ATM'           },
  HEALTH:        { Icon: Heart,           bg: '#3B1A1A', color: '#F87171', label: 'Health'        },
  EDUCATION:     { Icon: GraduationCap,   bg: '#1A3B2E', color: '#34D399', label: 'Education'    },
  ENTERTAINMENT: { Icon: Film,            bg: '#3D1E5F', color: '#C084FC', label: 'Entertainment' },
  EMI:           { Icon: Banknote,        bg: '#2E2E1A', color: '#A3E635', label: 'EMI'           },
  OTHER:         { Icon: MoreHorizontal,  bg: '#1E293B', color: '#94A3B8', label: 'Other'         },
};

export const ALL_CATEGORIES = Object.keys(CATEGORY_META) as TransactionCategory[];
