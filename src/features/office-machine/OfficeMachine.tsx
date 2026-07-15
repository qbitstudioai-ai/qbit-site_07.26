"use client";

import { useReducer } from "react";
import { HeroCopy } from "@/components/homepage/HeroCopy";
import { OfficeExperience } from "@/components/office/OfficeExperience";
import type { Department, HomepageCopy, OfficeZone } from "@/content/types";
import { initOfficeMachineState, officeMachineReducer } from "./reducer";

interface OfficeMachineProps {
  copy: HomepageCopy;
  departments: Department[];
  officeZones: OfficeZone[];
  initialRevealed: boolean;
}

export function OfficeMachine({
  copy,
  departments,
  officeZones,
  initialRevealed,
}: OfficeMachineProps) {
  const [state, dispatch] = useReducer(
    officeMachineReducer,
    initialRevealed,
    initOfficeMachineState,
  );

  const handleActivate = () => dispatch({ type: "ACTIVATE_CTA" });

  return (
    <>
      <HeroCopy copy={copy} onActivate={handleActivate} />
      <OfficeExperience
        interactionHint={copy.interactionHint}
        departments={departments}
        officeZones={officeZones}
        isRevealed={state.view === "overview"}
      />
    </>
  );
}
