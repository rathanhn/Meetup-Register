
import Image from "next/image";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, Instagram } from "lucide-react";
import Logo from "@/Logo.png";

const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        {...props}
    >
        <rect width="20" height="20" x="2" y="2" rx="5" ry="5"></rect>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
    </svg>
)


export function StoreDetails() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">
          About The Organizer
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center text-center gap-4">
        <Image
          src={Logo}
          alt="Event Logo"
          width={100}
          height={100}
          className="rounded-full border-2 border-primary p-1"
        />
        <div className="space-y-1">
            <h3 className="font-bold text-xl text-primary">RideRegister</h3>
            <p className="text-sm text-muted-foreground">Event Platform</p>
        </div>
        <CardDescription className="text-sm">
            Your platform for organizing and participating in exciting community bike rides.
        </CardDescription>
        <div className="w-full space-y-2">
            <Button asChild className="w-full bg-green-500 hover:bg-green-600">
                <Link href="https://wa.me/917899359217" target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" /> Connect on WhatsApp
                </Link>
            </Button>
             <Button asChild variant="outline" className="w-full">
                <Link href="https://www.instagram.com/telefun_" target="_blank" rel="noopener noreferrer">
                    <InstagramIcon className="mr-2 h-4 w-4" /> Follow us on Instagram
                </Link>
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
