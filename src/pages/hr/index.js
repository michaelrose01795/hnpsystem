// file location: src/pages/hr/index.js
import React, { useMemo } from "react";
import Link from "next/link";
import { useHrDashboardData } from "@/hooks/useHrData";
import { SectionCard } from "@/components/Section";
import { StatusMessage } from "@/components/ui";
import { MetricCard, StatusTag } from "@/components/HR/MetricCard";
import HrTabLoadingSkeleton from "@/components/HR/HrTabLoadingSkeleton";
import HrDashboardUi from "@/components/page-ui/hr/hr-ui"; // Extracted presentation layer.

export default function HrDashboard() {
  const { data, isLoading, error } = useHrDashboardData();

  const {
    hrDashboardMetrics = [],
    upcomingAbsences = [],
    activeWarnings = [],
    departmentPerformance = [],
    trainingRenewals = []
  } = data || {};

  const formattedMetrics = useMemo(() => {
    return hrDashboardMetrics.map((metric) => {
      if (metric.id === "totalEmployees") {
        return {
          icon: metric.icon,
          label: metric.label,
          primary: `${metric.active + metric.inactive}`,
          secondary: `${metric.active} active / ${metric.inactive} inactive`,
          trend: null
        };
      }

      return {
        icon: metric.icon,
        label: metric.label,
        primary: metric.value,
        secondary: null,
        trend: metric.trend
      };
    });
  }, [hrDashboardMetrics]);

  return <HrDashboardUi view="section1" activeWarnings={activeWarnings} departmentPerformance={departmentPerformance} error={error} formattedMetrics={formattedMetrics} HrTabLoadingSkeleton={HrTabLoadingSkeleton} isLoading={isLoading} Link={Link} MetricCard={MetricCard} SectionCard={SectionCard} StatusMessage={StatusMessage} StatusTag={StatusTag} trainingRenewals={trainingRenewals} upcomingAbsences={upcomingAbsences} />;




















































































































































































































}
