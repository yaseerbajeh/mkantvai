'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

export interface CartItem {
  product_code: string;
  product_name: string;
  price: number;
  quantity: number;
  image?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productCode: string) => void;
  updateQuantity: (productCode: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// Helper function to get cart key for a user
function getCartKey(userId: string | null): string {
  return userId ? `cart_${userId}` : 'cart_guest';
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();

  // Load cart for a specific user
  const loadCartForUser = (userId: string | null) => {
    if (typeof window === 'undefined') return;

    const cartKey = getCartKey(userId);
    const saved = localStorage.getItem(cartKey);
    
    if (saved) {
      try {
        const parsedItems = JSON.parse(saved);
        if (Array.isArray(parsedItems) && parsedItems.length > 0) {
          setItems(parsedItems);
        } else {
          setItems([]);
        }
      } catch (e) {
        console.error('Error loading cart:', e);
        localStorage.removeItem(cartKey);
        setItems([]);
      }
    } else {
      setItems([]);
    }
    
    // Mark as initialized after loading
    setIsInitialized(true);
  };

  // Listen to auth state changes to switch carts when user changes
  useEffect(() => {
    let mounted = true;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      const userId = session?.user?.id || null;
      setCurrentUserId(userId);
      loadCartForUser(userId);
    });

    // Listen for auth changes (login, logout, user switch)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const newUserId = session?.user?.id || null;
      
      // Use a ref-like approach - check if userId actually changed
      setCurrentUserId(prevUserId => {
        // If user changed (login, logout, or switch), clear old cart and load new one
        if (prevUserId !== newUserId) {
          // Clear the old cart from state
          setItems([]);
          // Load cart for the new user (or guest)
          setTimeout(() => loadCartForUser(newUserId), 0);
          return newUserId;
        }
        return prevUserId;
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array - only run once on mount

  // Save cart to localStorage whenever it changes (only after initialization)
  useEffect(() => {
    if (typeof window !== 'undefined' && isInitialized && currentUserId !== null) {
      const cartKey = getCartKey(currentUserId);
      localStorage.setItem(cartKey, JSON.stringify(items));
    } else if (typeof window !== 'undefined' && isInitialized && currentUserId === null) {
      // For guest users, use a temporary cart key
      localStorage.setItem('cart_guest', JSON.stringify(items));
    }
  }, [items, isInitialized, currentUserId]);

  // Save cart session to database for authenticated users (debounced)
  useEffect(() => {
    if (!isInitialized || !currentUserId || items.length === 0) return;

    // Debounce: wait 2 seconds after last change before saving to database
    const timeoutId = setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        
        await fetch('/api/cart/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            items,
            totalAmount: total,
            discountAmount: 0,
            promoCodeId: null,
          }),
        });
      } catch (error) {
        // Silently fail - cart session saving is optional
        console.error('Failed to save cart session:', error);
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [items, isInitialized, currentUserId]);

  const addItem = (item: CartItem) => {
    setItems(prev => {
      const existing = prev.find(i => i.product_code === item.product_code);
      if (existing) {
        toast({
          title: 'تم التحديث',
          description: `تم تحديث كمية ${item.product_name}`,
        });
        return prev.map(i =>
          i.product_code === item.product_code
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        );
      } else {
        toast({
          title: 'تم الإضافة',
          description: `تمت إضافة ${item.product_name} إلى السلة`,
        });
        return [...prev, item];
      }
    });
  };

  const removeItem = (productCode: string) => {
    setItems(prev => {
      const item = prev.find(i => i.product_code === productCode);
      if (item) {
        toast({
          title: 'تم الحذف',
          description: `تم حذف ${item.product_name} من السلة`,
        });
      }
      return prev.filter(i => i.product_code !== productCode);
    });
  };

  const updateQuantity = (productCode: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productCode);
      return;
    }
    setItems(prev =>
      prev.map(i =>
        i.product_code === productCode ? { ...i, quantity } : i
      )
    );
  };

  const clearCart = async () => {
    setItems([]);
    // Also clear from localStorage
    if (typeof window !== 'undefined' && currentUserId !== null) {
      const cartKey = getCartKey(currentUserId);
      localStorage.removeItem(cartKey);
      
      // Delete cart session from database
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await fetch('/api/cart/session', {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          });
        }
      } catch (error) {
        // Silently fail
        console.error('Failed to delete cart session:', error);
      }
    } else if (typeof window !== 'undefined') {
      localStorage.removeItem('cart_guest');
    }
    toast({
      title: 'تم الحذف',
      description: 'تم تفريغ السلة',
    });
  };

  const getTotal = () => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const getItemCount = () => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  };

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        getTotal,
        getItemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}
