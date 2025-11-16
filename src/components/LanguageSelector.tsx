import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe } from "lucide-react";

interface LanguageSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const languages = [
  { value: "en", label: "English", flag: "🇺🇸" },
  { value: "he", label: "עברית", flag: "🇮🇱" },
  { value: "ar", label: "العربية", flag: "🇸🇦" },
];

export const LanguageSelector = ({ value, onChange }: LanguageSelectorProps) => {
  const selectedLang = languages.find((l) => l.value === value);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px] gap-2">
        <Globe className="w-4 h-4 text-muted-foreground" />
        <SelectValue>
          {selectedLang && (
            <span className="flex items-center gap-2">
              <span>{selectedLang.flag}</span>
              <span>{selectedLang.label}</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {languages.map((lang) => (
          <SelectItem key={lang.value} value={lang.value}>
            <span className="flex items-center gap-2">
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
