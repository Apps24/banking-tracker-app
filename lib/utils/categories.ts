import { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react-native';
import {
  ArrowLeftRight,
  Phone,
  Wifi,
  Zap,
  CreditCard,
  Landmark,
  ShoppingBag,
  UtensilsCrossed,
  Car,
  Wallet,
  TrendingUp,
  Banknote,
  RotateCcw,
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

export const CATEGORY_META: Record<TransactionCategory, CategoryMeta> = {
  transfer:   { Icon: ArrowLeftRight,   bg: '#1E3A5F', color: '#60A5FA', label: 'Transfer'   },
  airtime:    { Icon: Phone,            bg: '#3D1E5F', color: '#C084FC', label: 'Airtime'    },
  data:       { Icon: Wifi,             bg: '#3D1E5F', color: '#C084FC', label: 'Data'       },
  bills:      { Icon: Zap,              bg: '#3B2E1A', color: '#F59E0B', label: 'Bills'      },
  pos:        { Icon: CreditCard,       bg: '#1A3B2E', color: '#34D399', label: 'POS'        },
  atm:        { Icon: Landmark,         bg: '#2E1A3B', color: '#A78BFA', label: 'ATM'        },
  shopping:   { Icon: ShoppingBag,      bg: '#3B1A2E', color: '#F472B6', label: 'Shopping'   },
  food:       { Icon: UtensilsCrossed,  bg: '#3B2E1A', color: '#FB923C', label: 'Food'       },
  transport:  { Icon: Car,              bg: '#1A2E3B', color: '#38BDF8', label: 'Transport'  },
  salary:     { Icon: Wallet,           bg: '#1A3B1A', color: '#4ADE80', label: 'Salary'     },
  investment: { Icon: TrendingUp,       bg: '#1A3B2E', color: '#10B981', label: 'Investment' },
  loan:       { Icon: Banknote,         bg: '#3B1A1A', color: '#F87171', label: 'Loan'       },
  reversal:   { Icon: RotateCcw,        bg: '#2E2E1A', color: '#A3A3A3', label: 'Reversal'   },
  other:      { Icon: MoreHorizontal,   bg: '#1E293B', color: '#94A3B8', label: 'Other'      },
};

export const ALL_CATEGORIES = Object.keys(CATEGORY_META) as TransactionCategory[];
