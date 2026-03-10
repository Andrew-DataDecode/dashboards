import { useState, useEffect, useRef } from 'react';
import { Box, Input } from '@chakra-ui/react';

interface TextFilterProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export default function TextFilter({ label, value, onChange }: TextFilterProps) {
  const [local, setLocal] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleChange = (v: string) => {
    setLocal(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(v), 300);
  };

  return (
    <Box>
      <Box as="label" display="block" fontSize="14px" fontWeight="500" color="text.secondary" mb="1">
        {label}
      </Box>
      <Box position="relative">
        <Input
          type="text"
          size="sm"
          placeholder={label}
          aria-label={`${label} search`}
          value={local}
          onChange={(e) => handleChange(e.target.value)}
          borderColor="border.subtle"
          pr={local ? "8" : undefined}
        />
        {local && (
          <Box
            as="button"
            position="absolute"
            right="2"
            top="50%"
            transform="translateY(-50%)"
            bg="none"
            border="none"
            cursor="pointer"
            color="text.secondary"
            fontSize="16px"
            lineHeight="1"
            onClick={() => handleChange('')}
          >
            &times;
          </Box>
        )}
      </Box>
    </Box>
  );
}
