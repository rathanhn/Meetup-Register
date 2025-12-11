
"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { addCoRider } from "@/app/actions";
import { Loader2, User, Upload } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";

const phoneRegex = new RegExp(
  /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/
);

// This component is no longer used and can be removed in the future.
// The co-rider logic has been replaced with vehicle-based registration.
const formSchema = z.object({
  fullName2: z.string().min(2, "Full name must be at least 2 characters."),
  age2: z.coerce.number().min(18, "Rider must be at least 18 years old.").max(100),
  phoneNumber2: z.string().regex(phoneRegex, "Invalid phone number."),
  photoURL2: z.any().refine(val => val, "Photo is required."),
});

interface AddCoRiderFormProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  registrationId: string;
}

export function AddCoRiderForm({ isOpen, setIsOpen, registrationId }: AddCoRiderFormProps) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { fullName2: "", age2: 18, phoneNumber2: "" },
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add a Co-Rider</DialogTitle>
          <DialogDescription>This feature is no longer available.</DialogDescription>
        </DialogHeader>
        <div className="p-4 text-center text-muted-foreground">
            The registration system has been updated to be per-vehicle instead of per-rider.
        </div>
      </DialogContent>
    </Dialog>
  );
}
