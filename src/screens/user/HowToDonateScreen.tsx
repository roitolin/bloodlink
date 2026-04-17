import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";

type FAQItem = {
  question: string;
  answer: string;
};

const FAQS: FAQItem[] = [
  {
    question: "HOW OFTEN CAN A PERSON DONATE?",
    answer: "A healthy individual may donate whole blood every three months.",
  },
  {
    question: "WILL DONATING BLOOD MAKE A PERSON WEAK?",
    answer:
      "Most donors feel normal after a short rest and fluids. Temporary lightheadedness can happen, but it usually passes quickly.",
  },
  {
    question: "CAN A PERSON WHO HAS A TATTOO OR BODY PIERCING STILL DONATE BLOOD?",
    answer:
      "Yes, in many cases. Eligibility depends on your local blood center rules and how long ago you had the tattoo or piercing.",
  },
  {
    question: "HOW LONG WILL IT TAKE TO DONATE BLOOD?",
    answer:
      "The whole visit usually takes around 45 to 60 minutes, while the actual blood draw often takes about 8 to 15 minutes.",
  },
  {
    question: "WILL I CONTRACT DISEASE THROUGH BLOOD DONATION?",
    answer:
      "No. Sterile, single-use needles and equipment are used for every donor, so blood donation is safe.",
  },
];

export default function HowToDonateScreen() {
  const [openIndex, setOpenIndex] = useState(-1);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>How to Donate</Text>
      <View style={styles.titleLine} />

      {FAQS.map((item, index) => {
        const isOpen = index === openIndex;
        return (
          <View key={item.question} style={styles.faqItem}>
            <TouchableOpacity
              style={[styles.questionRow, isOpen && styles.questionRowOpen]}
              onPress={() => setOpenIndex(isOpen ? -1 : index)}
              activeOpacity={0.8}
            >
              <Text style={[styles.questionText, isOpen && styles.questionTextOpen]}>
                {item.question}
              </Text>
              <View style={styles.iconCircle}>
                <Text style={styles.iconText}>{isOpen ? "-" : "+"}</Text>
              </View>
            </TouchableOpacity>
            {isOpen && <Text style={styles.answerText}>{item.answer}</Text>}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f2f2f2",
  },
  content: {
    padding: 20,
    paddingBottom: 30,
  },
  title: {
    fontSize: 52,
    fontWeight: "700",
    color: "#b92a2a",
    marginBottom: 16,
  },
  titleLine: {
    width: 120,
    height: 2,
    backgroundColor: "#aeb3b8",
    marginBottom: 24,
  },
  faqItem: {
    marginBottom: 12,
  },
  questionRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#b8bcc2",
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "#f2f2f2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  questionRowOpen: {
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  questionText: {
    color: "#6d737a",
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    paddingRight: 10,
  },
  questionTextOpen: {
    color: "#b92a2a",
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#c43232",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    lineHeight: 17,
  },
  answerText: {
    color: "#0d1116",
    fontSize: 16,
    lineHeight: 26,
    marginTop: 12,
    marginHorizontal: 2,
    marginBottom: 8,
  },
});

