/**
 * Complex mockup data for patients
 * This file contains realistic patient data structures that auto-load when backend starts
 */

const generateMockPatients = () => {
  const dataTypes = [
    "medical_records",
    "diagnostic_data",
    "genetic_data",
    "imaging_data",
    "laboratory_results",
    "prescription_history",
    "vital_signs",
    "treatment_history"
  ];

  const purposes = [
    "treatment",
    "research",
    "analytics",
    "diagnosis",
    "preventive_care",
    "clinical_trial",
    "public_health"
  ];

  const medicalConditions = [
    {
      code: "E11.9",
      name: "Type 2 diabetes mellitus without complications",
      category: "Endocrine",
      severity: "moderate"
    },
    {
      code: "I10",
      name: "Essential hypertension",
      category: "Cardiovascular",
      severity: "mild"
    },
    {
      code: "J44.1",
      name: "Chronic obstructive pulmonary disease with acute exacerbation",
      category: "Respiratory",
      severity: "severe"
    },
    {
      code: "M79.3",
      name: "Panniculitis, unspecified",
      category: "Musculoskeletal",
      severity: "moderate"
    },
    {
      code: "F41.1",
      name: "Generalized anxiety disorder",
      category: "Mental Health",
      severity: "mild"
    }
  ];

  const medications = [
    {
      name: "Metformin",
      dosage: "500mg",
      frequency: "twice daily",
      startDate: "2023-01-15",
      prescriber: "Dr. Sarah Johnson"
    },
    {
      name: "Lisinopril",
      dosage: "10mg",
      frequency: "once daily",
      startDate: "2023-03-20",
      prescriber: "Dr. Michael Chen"
    },
    {
      name: "Albuterol",
      dosage: "90mcg",
      frequency: "as needed",
      startDate: "2023-05-10",
      prescriber: "Dr. Emily Rodriguez"
    }
  ];

  const generateVitalSigns = () => {
    const baseDate = new Date();
    const vitals = [];
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() - i);
      
      vitals.push({
        timestamp: date.toISOString(),
        bloodPressure: {
          systolic: Math.floor(Math.random() * 30) + 110,
          diastolic: Math.floor(Math.random() * 20) + 70
        },
        heartRate: Math.floor(Math.random() * 40) + 60,
        temperature: (Math.random() * 2 + 36.5).toFixed(1),
        oxygenSaturation: Math.floor(Math.random() * 5) + 95,
        weight: (Math.random() * 20 + 65).toFixed(1),
        height: (Math.random() * 20 + 160).toFixed(1)
      });
    }
    
    return vitals;
  };

  const generateLabResults = () => {
    const labs = [];
    const testTypes = [
      { name: "Complete Blood Count", code: "CBC" },
      { name: "Comprehensive Metabolic Panel", code: "CMP" },
      { name: "Lipid Panel", code: "LIPID" },
      { name: "Hemoglobin A1C", code: "HbA1c" },
      { name: "Thyroid Stimulating Hormone", code: "TSH" }
    ];

    const baseDate = new Date();
    testTypes.forEach((test, index) => {
      const date = new Date(baseDate);
      date.setDate(date.getDate() - (index * 30));
      
      labs.push({
        testName: test.name,
        testCode: test.code,
        orderDate: date.toISOString(),
        resultDate: new Date(date.getTime() + 86400000).toISOString(),
        status: "completed",
        results: generateTestResults(test.code),
        referenceRange: getReferenceRange(test.code),
        orderingPhysician: `Dr. ${["Smith", "Johnson", "Williams", "Brown"][index % 4]}`
      });
    });

    return labs;
  };

  const generateTestResults = (testCode) => {
    const results = {};
    
    switch (testCode) {
      case "CBC":
        results.whiteBloodCellCount = (Math.random() * 3 + 4.5).toFixed(2);
        results.redBloodCellCount = (Math.random() * 1 + 4.5).toFixed(2);
        results.hemoglobin = (Math.random() * 3 + 12).toFixed(1);
        results.hematocrit = (Math.random() * 10 + 36).toFixed(1);
        results.plateletCount = Math.floor(Math.random() * 100000 + 150000);
        break;
      case "CMP":
        results.glucose = Math.floor(Math.random() * 40 + 70);
        results.creatinine = (Math.random() * 0.5 + 0.7).toFixed(2);
        results.sodium = Math.floor(Math.random() * 10 + 135);
        results.potassium = (Math.random() * 1 + 3.5).toFixed(1);
        results.alt = Math.floor(Math.random() * 30 + 10);
        results.ast = Math.floor(Math.random() * 30 + 10);
        break;
      case "LIPID":
        results.totalCholesterol = Math.floor(Math.random() * 60 + 150);
        results.ldlCholesterol = Math.floor(Math.random() * 50 + 100);
        results.hdlCholesterol = Math.floor(Math.random() * 20 + 40);
        results.triglycerides = Math.floor(Math.random() * 100 + 100);
        break;
      case "HbA1c":
        results.percentage = (Math.random() * 2 + 5).toFixed(1);
        results.mmolPerMol = Math.floor(parseFloat(results.percentage) * 10.929 + 20.7);
        break;
      case "TSH":
        results.value = (Math.random() * 3 + 0.5).toFixed(2);
        break;
    }
    
    return results;
  };

  const getReferenceRange = (testCode) => {
    const ranges = {
      "CBC": {
        whiteBloodCellCount: "4.5-11.0 x10^3/μL",
        redBloodCellCount: "4.5-5.5 x10^6/μL",
        hemoglobin: "12.0-16.0 g/dL",
        hematocrit: "36-46%",
        plateletCount: "150,000-450,000/μL"
      },
      "CMP": {
        glucose: "70-100 mg/dL",
        creatinine: "0.6-1.2 mg/dL",
        sodium: "135-145 mEq/L",
        potassium: "3.5-5.0 mEq/L",
        alt: "10-40 U/L",
        ast: "10-40 U/L"
      },
      "LIPID": {
        totalCholesterol: "<200 mg/dL",
        ldlCholesterol: "<100 mg/dL",
        hdlCholesterol: ">40 mg/dL",
        triglycerides: "<150 mg/dL"
      },
      "HbA1c": {
        percentage: "<5.7%",
        mmolPerMol: "<39 mmol/mol"
      },
      "TSH": {
        value: "0.4-4.0 mIU/L"
      }
    };
    
    return ranges[testCode] || {};
  };

  const generateImagingStudies = () => {
    const studies = [];
    const studyTypes = [
      { name: "Chest X-Ray", modality: "X-Ray", bodyPart: "Chest" },
      { name: "CT Scan - Head", modality: "CT", bodyPart: "Head" },
      { name: "MRI - Spine", modality: "MRI", bodyPart: "Spine" },
      { name: "Ultrasound - Abdomen", modality: "Ultrasound", bodyPart: "Abdomen" }
    ];

    const baseDate = new Date();
    studyTypes.forEach((study, index) => {
      const date = new Date(baseDate);
      date.setDate(date.getDate() - (index * 45));
      
      studies.push({
        studyId: `IMG-${Date.now()}-${index}`,
        studyType: study.name,
        modality: study.modality,
        bodyPart: study.bodyPart,
        orderDate: date.toISOString(),
        performedDate: new Date(date.getTime() + 86400000).toISOString(),
        status: "completed",
        findings: generateImagingFindings(study.modality),
        radiologist: `Dr. ${["Anderson", "Martinez", "Taylor", "Wilson"][index % 4]}`,
        orderingPhysician: `Dr. ${["Smith", "Johnson", "Williams"][index % 3]}`
      });
    });

    return studies;
  };

  const generateImagingFindings = (modality) => {
    const findings = {
      "X-Ray": "No acute cardiopulmonary abnormalities. Heart size is normal. Lungs are clear bilaterally.",
      "CT": "No intracranial hemorrhage or mass effect. Ventricles are normal in size. No acute infarct.",
      "MRI": "No significant disc herniation or spinal canal stenosis. Vertebral alignment is maintained.",
      "Ultrasound": "Liver, gallbladder, pancreas, and spleen appear normal. No focal lesions identified."
    };
    
    return findings[modality] || "Study completed. No significant abnormalities detected.";
  };

  const generateGeneticData = () => {
    return {
      sequencingDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
      variants: [
        {
          gene: "BRCA1",
          variant: "c.5266dupC",
          classification: "Pathogenic",
          significance: "Increased risk for breast and ovarian cancer"
        },
        {
          gene: "CYP2D6",
          variant: "*4/*4",
          classification: "Pharmacogenetic",
          significance: "Poor metabolizer - may require dose adjustment for certain medications"
        }
      ],
      pharmacogenomics: {
        warfarin: "Sensitive - lower dose recommended",
        clopidogrel: "Normal metabolizer",
        codeine: "Poor metabolizer - alternative medication recommended"
      }
    };
  };

  const patients = [];

  // Generate 10 mock patients with complex data structures
  for (let i = 0; i < 10; i++) {
    const patientId = `PAT-${String(i + 1).padStart(6, '0')}`;
    const birthDate = new Date(1950 + Math.floor(Math.random() * 50), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
    const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    
    const patient = {
      patientId: patientId,
      demographics: {
        firstName: ["John", "Jane", "Michael", "Sarah", "David", "Emily", "Robert", "Jessica", "William", "Ashley"][i],
        lastName: ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez"][i],
        dateOfBirth: birthDate.toISOString().split('T')[0],
        age: age,
        gender: i % 2 === 0 ? "Male" : "Female",
        ethnicity: ["Caucasian", "Hispanic", "African American", "Asian", "Native American"][i % 5],
        address: {
          street: `${Math.floor(Math.random() * 9999) + 1} Main Street`,
          city: ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix"][i % 5],
          state: ["NY", "CA", "IL", "TX", "AZ"][i % 5],
          zipCode: String(Math.floor(Math.random() * 90000) + 10000),
          country: "USA"
        },
        contact: {
          phone: `555-${String(Math.floor(Math.random() * 9000) + 1000)}`,
          email: `patient${i + 1}@example.com`
        },
        emergencyContact: {
          name: `Emergency Contact ${i + 1}`,
          relationship: ["Spouse", "Child", "Parent", "Sibling"][i % 4],
          phone: `555-${String(Math.floor(Math.random() * 9000) + 1000)}`
        }
      },
      medicalHistory: {
        conditions: medicalConditions.slice(0, Math.floor(Math.random() * 3) + 1).map(condition => ({
          ...condition,
          diagnosisDate: new Date(Date.now() - Math.random() * 365 * 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: ["Active", "Resolved", "Chronic"][Math.floor(Math.random() * 3)]
        })),
        allergies: [
          { allergen: "Penicillin", severity: "Moderate", reaction: "Rash" },
          { allergen: "Latex", severity: "Mild", reaction: "Skin irritation" }
        ].slice(0, Math.floor(Math.random() * 2)),
        surgeries: [
          {
            procedure: "Appendectomy",
            date: new Date(Date.now() - Math.random() * 365 * 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            surgeon: "Dr. Thompson"
          }
        ].slice(0, Math.floor(Math.random() * 2))
      },
      currentMedications: medications.slice(0, Math.floor(Math.random() * 3) + 1),
      vitalSigns: generateVitalSigns(),
      laboratoryResults: generateLabResults(),
      imagingStudies: generateImagingStudies(),
      geneticData: i % 3 === 0 ? generateGeneticData() : null, // Only some patients have genetic data
      insurance: {
        provider: ["Blue Cross", "Aetna", "UnitedHealthcare", "Cigna", "Humana"][i % 5],
        policyNumber: `POL-${String(Math.floor(Math.random() * 999999) + 100000)}`,
        groupNumber: `GRP-${String(Math.floor(Math.random() * 9999) + 1000)}`,
        effectiveDate: new Date(Date.now() - Math.random() * 365 * 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      },
      consentHistory: [],
      accessLog: [],
      metadata: {
        createdAt: new Date(Date.now() - Math.random() * 365 * 2 * 24 * 60 * 60 * 1000).toISOString(),
        lastUpdated: new Date().toISOString(),
        dataVersion: "1.0",
        encryptionStatus: "encrypted",
        dataIntegrityHash: `hash-${Math.random().toString(36).substring(2, 15)}`
      }
    };

    patients.push(patient);
  }

  return {
    patients,
    metadata: {
      totalPatients: patients.length,
      generatedAt: new Date().toISOString(),
      dataTypes,
      purposes,
      schemaVersion: "2.1"
    }
  };
};

// Auto-export the generated data
module.exports = {
  mockPatients: generateMockPatients(),
  dataTypes: [
    "medical_records",
    "diagnostic_data",
    "genetic_data",
    "imaging_data",
    "laboratory_results",
    "prescription_history",
    "vital_signs",
    "treatment_history"
  ],
  purposes: [
    "treatment",
    "research",
    "analytics",
    "diagnosis",
    "preventive_care",
    "clinical_trial",
    "public_health"
  ]
};

