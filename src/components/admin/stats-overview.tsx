
"use client";

import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Registration } from '@/lib/types';
import { Loader2, AlertTriangle, Users, User, Ticket, Bike, Tractor, Car } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { PieChart, Pie, Cell } from "recharts"
import { useMemoFirebase } from '@/firebase/memo';

export function StatsOverview() {
  const registrationsQuery = useMemoFirebase(() => query(collection(db, 'registrations'), where('status', 'in', ['approved', 'pending'])), []);
  const { data: registrationsData, loading, error } = useCollection<Registration>(registrationsQuery);

  if (loading) {
    return (
      // Skeleton loading state
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Loading...</CardTitle>
              </CardHeader>
              <CardContent>
                <Loader2 className="h-6 w-6 animate-spin" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Registration Types</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center h-[300px]">
                <Loader2 className="h-8 w-8 animate-spin" />
            </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-destructive flex items-center gap-2 p-4 border border-destructive/50 rounded-lg">
        <AlertTriangle />
        <p>Error loading stats: {error.message}</p>
      </div>
    );
  }

  const registrations = registrationsData || [];
  
  const totalRegistrations = registrations.length;
  
  const totalParticipants = registrations.length; // Now 1 per registration

  const bikeCount = registrations.filter(reg => reg.registrationType === 'bike').length;
  const jeepCount = registrations.filter(reg => reg.registrationType === 'jeep').length;
  const carCount = registrations.filter(reg => reg.registrationType === 'car').length;

  const chartData = [
    { type: 'Bikes', count: bikeCount, fill: 'var(--color-bike)' },
    { type: 'Jeeps', count: jeepCount, fill: 'var(--color-jeep)' },
    { type: 'Cars', count: carCount, fill: 'var(--color-car)' },
  ];

  const chartConfig = {
    count: {
      label: "Count",
    },
    bike: {
      label: "Bikes",
      color: "hsl(var(--chart-1))",
    },
    jeep: {
      label: "Jeeps",
      color: "hsl(var(--chart-2))",
    },
    car: {
        label: "Cars",
        color: "hsl(var(--chart-3))",
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Registrations</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRegistrations}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Participants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalParticipants}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bikes</CardTitle>
            <Bike className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bikeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Jeeps & Cars</CardTitle>
            <div className='flex gap-2'><Tractor className="h-4 w-4 text-muted-foreground" /> <Car className="h-4 w-4 text-muted-foreground" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jeepCount + carCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vehicle Types Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {totalRegistrations > 0 ? (
            <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[250px]">
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Pie
                  data={chartData}
                  dataKey="count"
                  nameKey="type"
                  innerRadius={60}
                  strokeWidth={5}
                >
                  <Cell name="Bikes" fill="var(--color-bike)" />
                  <Cell name="Jeeps" fill="var(--color-jeep)" />
                   <Cell name="Cars" fill="var(--color-car)" />
                </Pie>
                <ChartLegend
                    content={<ChartLegendContent nameKey="type" />}
                    className="flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
                />
              </PieChart>
            </ChartContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-muted-foreground">
              No registration data to display.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
