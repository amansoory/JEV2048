import unittest
from server import validate,slide
class Validation(unittest.TestCase):
 def test_shape_and_extra_fields(self):
  for b in [{'board':[0]*16},{'board':[2]*15},{'board':[True]*16},{'board':[3]*16},{'board':[65536]*16},{'board':[2]*16,'command':'x'},{'board':[2]*16,'filename':'x'}]:
   with self.assertRaises(ValueError):validate(b)
 def test_merge_overflow_is_rejected(self):
  with self.assertRaises(ValueError):validate({'board':[32768,32768]+[0]*14})
 def test_legal_actions_and_order(self):
  b=[2,2,2,2]+[0]*12;_,options=validate({'board':b})
  self.assertEqual(options['left'],([4,4]+[0]*14,8));self.assertEqual(b,[2,2,2,2]+[0]*12)
if __name__=='__main__':unittest.main()
