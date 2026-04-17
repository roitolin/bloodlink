import { useState } from 'react'

const FAQS = [
  {
    question: 'How often can a person donate?',
    answer: 'A healthy individual may donate whole blood every three months.',
  },
  {
    question: 'Will donating blood make a person weak?',
    answer:
      'Most donors feel normal after a short rest and fluids. Temporary lightheadedness can happen, but it usually passes quickly.',
  },
  {
    question: 'Can a person who has a tattoo or body piercing still donate blood?',
    answer:
      'Yes, in many cases. Eligibility depends on your local blood center rules and how long ago you had the tattoo or piercing.',
  },
  {
    question: 'How long will it take to donate blood?',
    answer:
      'The whole visit usually takes around 45 to 60 minutes, while the actual blood draw often takes about 8 to 15 minutes.',
  },
  {
    question: 'Will I contract disease through blood donation?',
    answer:
      'No. Sterile, single-use needles and equipment are used for every donor, so blood donation is safe.',
  },
]

function HowToDonateFaq() {
  const [openIndex, setOpenIndex] = useState(-1)

  return (
    <div className="donate-faq-shell">
      <header className="donate-faq-head">
        <h2>Donation Eligibility</h2>
        <p>Frequently asked questions about becoming a donor.</p>
      </header>

      <div className="howto-faq-list">
        {FAQS.map((item, index) => {
          const isOpen = index === openIndex

          return (
            <article key={item.question} className="howto-faq-item">
              <button
                type="button"
                className={`howto-question${isOpen ? ' is-open' : ''}`}
                onClick={() => setOpenIndex(isOpen ? -1 : index)}
                aria-expanded={isOpen}
              >
                <span>{item.question}</span>
                <span className="howto-toggle" aria-hidden="true">{isOpen ? '-' : '+'}</span>
              </button>
              {isOpen ? <p className="howto-answer">{item.answer}</p> : null}
            </article>
          )
        })}
      </div>
    </div>
  )
}

export default HowToDonateFaq
