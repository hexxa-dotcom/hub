'use client';

import { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

type AnimatedNumberProps = {
  value: number;
  format?: (n: number) => string;
  className?: string;
};

export function AnimatedNumber({ value, format, className }: AnimatedNumberProps) {
  const spring = useSpring(0, { mass: 0.8, stiffness: 75, damping: 15 });
  const [displayValue, setDisplayValue] = useState(
    format ? format(value) : value.toLocaleString('pt-BR')
  );

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  useEffect(() => {
    const unsubscribe = spring.on('change', (latest) => {
      if (format) {
        setDisplayValue(format(latest));
      } else {
        setDisplayValue(Math.round(latest).toLocaleString('pt-BR'));
      }
    });
    return () => unsubscribe();
  }, [spring, format]);

  return <motion.span className={className}>{displayValue}</motion.span>;
}
