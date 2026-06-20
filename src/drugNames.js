/**
 * Offline list of common FDA-approved generic drug names for the non-DM
 * "home medications" autocomplete. Curated common-outpatient set (generic
 * names; not every brand/strength/NDC) so the tool stays fully offline —
 * nothing is transmitted. Extend RAW as needed. The export is deduped and
 * sorted case-insensitively, so the combobox can prefix-filter directly.
 */
const RAW = [
  // A
  "Acarbose", "Acetaminophen", "Acetazolamide", "Acyclovir", "Albuterol", "Alendronate",
  "Alfuzosin", "Aliskiren", "Allopurinol", "Alogliptin", "Alprazolam", "Amiloride",
  "Amiodarone", "Amitriptyline", "Amlodipine", "Amoxicillin", "Amoxicillin-clavulanate",
  "Ampicillin", "Anastrozole", "Apixaban", "Aripiprazole", "Aspirin", "Atenolol",
  "Atomoxetine", "Atorvastatin", "Azathioprine", "Azelastine", "Azithromycin",
  // B
  "Baclofen", "Beclomethasone", "Benazepril", "Benztropine", "Betamethasone", "Bimatoprost",
  "Bisacodyl", "Bisoprolol", "Brimonidine", "Budesonide", "Bumetanide", "Buprenorphine",
  "Bupropion", "Buspirone",
  // C
  "Canagliflozin", "Candesartan", "Captopril", "Carbamazepine", "Carbidopa-levodopa",
  "Carvedilol", "Cefdinir", "Cefixime", "Cefpodoxime", "Ceftriaxone", "Cefuroxime",
  "Celecoxib", "Cephalexin", "Cetirizine", "Chlorthalidone", "Cholecalciferol",
  "Ciprofloxacin", "Citalopram", "Clarithromycin", "Clindamycin", "Clobetasol",
  "Clonazepam", "Clonidine", "Clopidogrel", "Clotrimazole", "Codeine", "Colchicine",
  "Cyanocobalamin", "Cyclobenzaprine", "Cyclosporine",
  // D
  "Dabigatran", "Dapagliflozin", "Desloratadine", "Desogestrel", "Desvenlafaxine",
  "Dexamethasone", "Dexlansoprazole", "Dextroamphetamine", "Diazepam", "Diclofenac",
  "Dicyclomine", "Digoxin", "Diltiazem", "Diphenhydramine", "Divalproex", "Docusate",
  "Donepezil", "Dorzolamide", "Doxazosin", "Doxepin", "Doxycycline", "Dulaglutide",
  "Duloxetine", "Dutasteride",
  // E
  "Eletriptan", "Empagliflozin", "Enalapril", "Enoxaparin", "Ergocalciferol",
  "Ertugliflozin", "Erythromycin", "Escitalopram", "Esomeprazole", "Estradiol",
  "Eszopiclone", "Ethinyl estradiol", "Exenatide", "Ezetimibe",
  // F
  "Famotidine", "Febuxostat", "Felodipine", "Fenofibrate", "Ferrous sulfate",
  "Fexofenadine", "Finasteride", "Flecainide", "Fluconazole", "Fluoxetine",
  "Fluticasone", "Fluvastatin", "Folic acid", "Formoterol", "Furosemide",
  // G
  "Gabapentin", "Galantamine", "Gemfibrozil", "Gentamicin", "Glargine", "Gliclazide",
  "Glimepiride", "Glipizide", "Glyburide", "Guaifenesin", "Guanfacine",
  // H
  "Haloperidol", "Hydralazine", "Hydrochlorothiazide", "Hydrocortisone", "Hydromorphone",
  "Hydroxychloroquine", "Hydroxyzine", "Hyoscyamine",
  // I
  "Ibandronate", "Ibuprofen", "Indapamide", "Indomethacin", "Insulin aspart",
  "Insulin degludec", "Insulin detemir", "Insulin glargine", "Insulin lispro",
  "Ipratropium", "Irbesartan", "Isosorbide dinitrate", "Isosorbide mononitrate",
  "Isotretinoin", "Itraconazole",
  // K
  "Ketoconazole", "Ketorolac",
  // L
  "Labetalol", "Lamotrigine", "Lansoprazole", "Latanoprost", "Leflunomide", "Letrozole",
  "Levalbuterol", "Levetiracetam", "Levocetirizine", "Levofloxacin", "Levothyroxine",
  "Linagliptin", "Linezolid", "Liothyronine", "Liraglutide", "Lisdexamfetamine",
  "Lisinopril", "Lithium", "Loperamide", "Loratadine", "Lorazepam", "Losartan",
  "Lovastatin", "Lurasidone",
  // M
  "Meclizine", "Medroxyprogesterone", "Meloxicam", "Memantine", "Mesalamine",
  "Metformin", "Methadone", "Methimazole", "Methocarbamol", "Methotrexate",
  "Methylphenidate", "Methylprednisolone", "Metoclopramide", "Metolazone", "Metoprolol",
  "Metronidazole", "Midodrine", "Minocycline", "Mirabegron", "Mirtazapine", "Mometasone",
  "Montelukast", "Morphine", "Moxifloxacin", "Mupirocin", "Mycophenolate",
  // N
  "Nadolol", "Naproxen", "Nateglinide", "Nebivolol", "Nifedipine", "Nitrofurantoin",
  "Nitroglycerin", "Nortriptyline", "Nystatin",
  // O
  "Olanzapine", "Olmesartan", "Omeprazole", "Ondansetron", "Oseltamivir", "Oxcarbazepine",
  "Oxybutynin", "Oxycodone",
  // P
  "Pantoprazole", "Paroxetine", "Penicillin V", "Phenazopyridine", "Phenytoin",
  "Pioglitazone", "Polyethylene glycol", "Potassium chloride", "Pramipexole",
  "Pravastatin", "Prazosin", "Prednisolone", "Prednisone", "Pregabalin", "Primidone",
  "Prochlorperazine", "Progesterone", "Promethazine", "Propranolol", "Pseudoephedrine",
  // Q
  "Quetiapine", "Quinapril",
  // R
  "Rabeprazole", "Raloxifene", "Ramipril", "Ranolazine", "Rasagiline", "Repaglinide",
  "Risedronate", "Risperidone", "Rivaroxaban", "Rivastigmine", "Rizatriptan",
  "Ropinirole", "Rosuvastatin",
  // S
  "Sacubitril-valsartan", "Salmeterol", "Saxagliptin", "Selegiline", "Semaglutide",
  "Senna", "Sertraline", "Sildenafil", "Simvastatin", "Sitagliptin", "Solifenacin",
  "Spironolactone", "Sucralfate", "Sulfamethoxazole-trimethoprim", "Sulfasalazine",
  "Sumatriptan",
  // T
  "Tacrolimus", "Tadalafil", "Tamoxifen", "Tamsulosin", "Telmisartan", "Terazosin",
  "Terbinafine", "Testosterone", "Tetracycline", "Theophylline", "Timolol", "Tiotropium",
  "Tirzepatide", "Tizanidine", "Tolterodine", "Topiramate", "Torsemide", "Tramadol",
  "Trazodone", "Triamcinolone", "Triamterene", "Trimethoprim",
  // U
  "Umeclidinium",
  // V
  "Valacyclovir", "Valproic acid", "Valsartan", "Vardenafil", "Venlafaxine", "Verapamil",
  "Vitamin D",
  // W
  "Warfarin",
  // Z
  "Zolpidem", "Zonisamide",
];

export const DRUG_NAMES = Array.from(new Set(RAW.map((s) => s.trim()).filter(Boolean))).sort((a, b) =>
  a.localeCompare(b, "en", { sensitivity: "base" })
);
